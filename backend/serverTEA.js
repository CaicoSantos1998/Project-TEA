const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const PDFDocument = require('pdfkit');
const { error } = require('console');

const st = express();

st.set('trust proxy', 1);

st.use(cors({
    origin: 'https://project-tea.onrender.com',
    credentials: true
}));

st.use(session({
    secret: 'key-secret-safe',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: true,
        sameSite: 'lax'
    }
}));

st.use(express.json());

const db = mysql.createPool({
	uri: 'mysql://root:rNpyYjhhRoadYPHZXttDfVLaGcGlEfTm@gondola.proxy.rlwy.net:42035/railway'
});

async function createTables() {
  try {
    const conn = await db.getConnection();

    await conn.query(`
      CREATE TABLE IF NOT EXISTS estado (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sigla VARCHAR(2) NOT NULL
      );
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS cidade (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        idEstado INT,
        FOREIGN KEY (idEstado) REFERENCES estado(id)
      );
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS distrito (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        idCidade INT,
        FOREIGN KEY (idCidade) REFERENCES cidade(id)
      );
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS pessoa (
        id int primary key auto_increment,
        nome varchar(130) not null,
        sexo varchar(20),
        email varchar(50) null,
        telefone varchar(11),
        bairro varchar(150),
        rua varchar(150),
        numeroImovel char(5),
        complemento varchar(30) null,
        temEsgotoAi varchar(5),
        ondeEJogado varchar(20),
        idDistrito int,
        constraint foreign key fkIdDistrito(idDistrito) references distrito(id)
        );
    `);

    console.log('Tabelas criadas com sucesso!');
    conn.release();
  } catch (error) {
    console.error('Erro ao criar as tabelas:', error.message);
  }
};

st.use(express.static(path.join(__dirname, '..', 'public')));

async function testConnection() {
	try {
		const conn = await db.getConnection();
        const [rows] = await conn.query('SELECT 1')
		console.log('Conexão com o banco funcionando!');
		conn.release();
	} catch (error) {
		console.error('Erro ao conectar ao banco:', error.message);
	}
}

testConnection();
createTables();

st.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'html', 'index.html'));
});

st.get('/consultar-dados', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'html', 'consultar-dados.html'));
});

st.get('/sobre-projeto', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'html', 'sobre-projeto.html'));
});

st.post('/form', async (req, res) => {
    console.log('Recebido:', req.body);

    const {
        nome, sexo, email, telefone, bairro, rua,
        numeroImovel, complemento, distrito, cidade,
        estado, temEsgotoAi, ondeEJogado
    } = req.body;

    if (!nome) {
        return res.status(400).json({ error: 'Nome é obrigatório' });
    }

    console.log(`Dados recebidos para inserção: ${nome}, ${sexo}, ${email}, ${telefone}, ${bairro}, ${rua}, ${numeroImovel}, ${complemento}, ${distrito}, ${cidade}, ${estado}, ${temEsgotoAi}, ${ondeEJogado}`)

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        console.log('Verificando estado...')
        const [est] = await conn.execute(
            'SELECT id FROM estado WHERE sigla = ? LIMIT 1', [estado]
        );

        const idEstado = est.length ? est[0].id :
            (await conn.execute('INSERT INTO estado (sigla) VALUES (?)', [estado]))[0].insertId;

        console.log('Estado identificado ou inserido:',idEstado);

        const [cid] = await conn.execute(
            'SELECT id FROM cidade WHERE nome = ? AND idEstado = ? LIMIT 1',
            [cidade, idEstado]
        );
        const idCidade = cid.length ? cid[0].id :
            (await conn.execute('INSERT INTO cidade (nome, idEstado) VALUES (?, ?)', [cidade, idEstado]))[0].insertId;

        console.log('Cidade identificada ou inserida:', idCidade);

        const [dist] = await conn.execute(
            'SELECT id FROM distrito WHERE nome = ? AND idCidade = ? LIMIT 1',
            [distrito, idCidade]
        );
        const idDistrito = dist.length ? dist[0].id :
            (await conn.execute('INSERT INTO distrito (nome, idCidade) VALUES (?, ?)', [distrito, idCidade]))[0].insertId;

        console.log('Distrito identificado ou inserido:', idDistrito);

        await conn.execute(
            `INSERT INTO pessoa
            (nome, sexo, email, telefone, bairro, rua, numeroImovel, complemento, temEsgotoAi, ondeEJogado, idDistrito)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [nome, sexo, email, telefone, bairro, rua, numeroImovel, complemento, temEsgotoAi, ondeEJogado, idDistrito]
        );

        console.log('Dados inseridos com sucesso!')

        await conn.commit();
        res.status(201).json({ message: 'Dados enviados com sucesso!' });
    } catch (error) {
        console.error("Erro no servidr:", error);
        await conn.rollback();
        res.status(500).json({ error: `Erro interno: ${error.message}`});
    } finally {
        conn.release();
    }
});

st.get('/percentage', async (req, res) => {
    const filter = req.query.filter;

    try {
        let query = '';

        if (filter === 'bairro') {
            query = `
                SELECT 
                    LOWER(TRIM(bairro)) AS nome,
                    temEsgotoAi,
                    COUNT(*) AS total,
                    ROUND((COUNT(*) / (SELECT COUNT(*) FROM pessoa WHERE bairro IS NOT NULL AND bairro != '')) * 100, 2) AS percentage
                FROM pessoa
                WHERE bairro IS NOT NULL AND bairro != ''
                GROUP BY LOWER(TRIM(bairro)), temEsgotoAi
                ORDER BY nome
            `;
        } else if (filter === 'rua') {
            query = `
                SELECT 
                    LOWER(TRIM(rua)) AS nome,
                    temEsgotoAi,
                    COUNT(*) AS total,
                    ROUND((COUNT(*) / (SELECT COUNT(*) FROM pessoa WHERE rua IS NOT NULL AND rua != '')) * 100, 2) AS percentage
                FROM pessoa
                WHERE rua IS NOT NULL AND rua != ''
                GROUP BY LOWER(TRIM(rua)), temEsgotoAi
                ORDER BY nome
            `;
        } else {
            query = `
                SELECT 
                    temEsgotoAi,
                    COUNT(*) AS total,
                    ROUND((COUNT(*) / (SELECT COUNT(*) FROM pessoa)) * 100, 2) AS percentage
                FROM pessoa
                GROUP BY temEsgotoAi
            `;
        }

        const [rows] = await db.execute(query);
        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar dados para gráfico:', error);
        res.status(500).json({ error: 'Erro ao buscar dados para gráfico' });
    }
});

st.get('/bairros', async (req, res) => {
    try {
        const [rows] = await db.execute(
            'SELECT DISTINCT bairro FROM pessoa WHERE idDistrito = ?', [1]
        );
        res.json(rows.map(r => r.bairro));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao buscar bairros' });
    }
});

st.get('/ruas', async (req, res) => {
    try {
        const [rows] = await db.execute(
            'SELECT DISTINCT rua FROM pessoa WHERE idDistrito = ?', [1]
        );
        res.json(rows.map(r => r.rua));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao buscar ruas' });
    }
});

st.post('/login', (req, res) => {
    const { username, password } = req.body;

    const users = [
        { username: 'root', password: '052547Santos..' },
        { username: 'pfmaragogipe', password: 'h1h2h3TEA' }
    ];

    const valid = users.find(user => user.username === username && user.password === password);

    if (valid) {
        req.session.autentic = true;
        req.session.user = username;
        res.json({ success: true });
    } else {
        res.json({ success: false });
    }
});

st.get('/test', (req, res) => {
    res.send('IS WORKING!!!')
})

st.get('/check-login', (req, res) => {
    res.json({ logado: !!req.session.autentic });
})

async function findDataDatabase() {
    return new Promise((resolve, reject) => {
        connection.query(
            'SELECT nome, email, telefone FROM pessoa',
            (error, results) => {
                if (error) {
                    console.error('Erro na consulta SQL:', err);
                    return reject(error);
                }
                resolve(results);
            }
        );
    });
}

st.get('/document.pdf', async (req, res) => {
    if (!req.session.autentic) {
        return res.status(403).send('Acesso negado!');
    }

    try {
        const dados = await findDataDatabase();

        const doc = new PDFDocument();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=document.pdf');
        doc.pipe(res);

        doc.fontSize(18).text('Relatório privado', { align: 'center' });
        doc.moveDown();

        if (dados.length > 0) {
            Object.keys(dados[0]).forEach(key => {
                doc.fontSize(12).text(key, { continued: true }).text(' | ', { continued: true });
            });

            doc.moveDown();

            dados.forEach(item => {
                Object.values(item).forEach(value => {
                    doc.fontSize(10).text(String(value), { continued: true }).text(' | ', { continued: true });
                });
                doc.moveDown();
            });
        } else {
            doc.text('Nenhum dado encontrado.');
        }

        doc.end();
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao gerar PDF');
    }
});

st.get('/dataProtected', async (req, res) => {
    if (!req.session.autentic) {
        return res.status(403).json({ error: 'Acesso negado!' });
    }

    try {
        const dados = await findDataDatabase();
        res.json(dados);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao carregar os dados' });
    }
});

const PORT = process.env.PORT || 3000;
st.listen(PORT, () => {
    console.log(`Servidor funcionando na porta ${PORT}`);
});
