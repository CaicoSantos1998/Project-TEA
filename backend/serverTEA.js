const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');

const st = express();
st.use(cors());
st.use(express.json());

const db = mysql.createPool({
	uri: 'mysql://root:BiSViYxCHnnPUidqCYDyvXpCzMaMjuff@shuttle.proxy.rlwy.net:35093/railway'
});

st.use(express.static(path.join(__dirname, 'public/html')));

async function testConnection() {
	try {
		const conn = await db.getConnection();
		const [rows] = await conn.query('SELECT 1');
		console.log('Conexão com o banco funcionando!');
		conn.release();
	} catch (error) {
		console.error('Erro ao conectar ao banco:', error.message);
	}
}

testConnection();

st.get('/', (req, res) => {
    res.send('Servidor funcionando!');
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

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const [est] = await conn.execute(
            'SELECT id FROM estado WHERE sigla = ? LIMIT 1', [estado]
        );
        const idEstado = est.length ? est[0].id :
            (await conn.execute('INSERT INTO estado (sigla) VALUES (?)', [estado]))[0].insertId;

        const [cid] = await conn.execute(
            'SELECT id FROM cidade WHERE nome = ? AND idEstado = ? LIMIT 1',
            [cidade, idEstado]
        );
        const idCidade = cid.length ? cid[0].id :
            (await conn.execute('INSERT INTO cidade (nome, idEstado) VALUES (?, ?)', [cidade, idEstado]))[0].insertId;

        const [dist] = await conn.execute(
            'SELECT id FROM distrito WHERE nome = ? AND idCidade = ? LIMIT 1',
            [distrito, idCidade]
        );
        const idDistrito = dist.length ? dist[0].id :
            (await conn.execute('INSERT INTO distrito (nome, idCidade) VALUES (?, ?)', [distrito, idCidade]))[0].insertId;

        await conn.execute(
            `INSERT INTO pessoa
            (nome, sexo, email, telefone, bairro, rua, numeroImovel, complemento, temEsgotoAi, ondeEJogado, idDistrito)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [nome, sexo, email, telefone, bairro, rua, numeroImovel, complemento, temEsgotoAi, ondeEJogado, idDistrito]
        );

        await conn.commit();
        res.status(201).json({ message: 'Dados enviados com sucesso!' });
    } catch (error) {
        await conn.rollback();
        console.error(error);
        res.status(500).json({ error: 'Erro interno!' });
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
        res.json({ success: true });
    } else {
        res.json({ success: false });
    }
});

st.get('/dataProtected', async (req, res) => {
    try {
        const { nome, sexo, bairro, cidade, uf } = req.query;

        let query = `
            SELECT p.nome AS 'Nome Pessoa', p.sexo, p.telefone, p.email, p.bairro, p.numeroImovel, p.complemento,
                   ds.nome AS 'Nome Distrito', cd.nome AS 'Nome Cidade', et.sigla AS 'UF'
            FROM pessoa p
            INNER JOIN distrito ds ON p.idDistrito = ds.id
            INNER JOIN cidade cd ON ds.idCidade = cd.id
            INNER JOIN estado et ON cd.idEstado = et.id
        `;

        const filters = [];
        if (nome) filters.push(`p.nome LIKE '%${nome}%'`);
        if (sexo) filters.push(`p.sexo = '${sexo}'`);
        if (bairro) filters.push(`p.bairro LIKE '%${bairro}%'`);
        if (cidade) filters.push(`cd.nome LIKE '%${cidade}%'`);
        if (uf) filters.push(`et.sigla LIKE '%${uf}%'`);

        if (filters.length > 0) {
            query += ' WHERE ' + filters.join(' AND ');
        }

        query += ' ORDER BY 1';

        const [rows] = await db.query(query);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao buscar dados protegidos' });
    }
});

const PORT = process.env.PORT || 3000;
st.listen(PORT, () => {
    console.log(`Servidor funcionando na porta ${PORT}`);
});
