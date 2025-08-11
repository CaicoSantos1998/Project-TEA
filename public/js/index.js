document.addEventListener('DOMContentLoaded', () => {
    const mostrarGraficoButton = document.getElementById('mostrarGraficoButton');
    const mostrarDetalhesButton = document.getElementById('showDetail');
    const screenLogin = document.getElementById('screen-login');
    const detailSection = document.getElementById('detail');
    const dataProtectedSection = document.getElementById('dataProtected');
    const canvas = document.getElementById('myChart');
    const dadosDetalhadosTitle = document.getElementById('dadosDetalhadosTitle');
    const form = document.getElementById('formPessoas'); 

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const formData = new FormData(form);
            const dados = Object.fromEntries(formData.entries());

            try {
                const response = await fetch('https://project-tea.onrender.com/form', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(dados),
                });

                const data = await response.json();

                if (data.message) {
                    alert(data.message);
                } else {
                    alert('Erro: ' + data.error);
                }

            } catch (error) {
                console.error('Erro ao enviar dados:', error);
                alert('Erro ao enviar dados. Tente novamente mais tarde.');
            }
        });
    }

    screenLogin.style.display = 'none';
    detailSection.style.display = 'none';
    dataProtectedSection.style.display = 'none';
    canvas.style.display = 'none';

    if (dadosDetalhadosTitle) dadosDetalhadosTitle.style.display = 'none';

    function toggleSections(showGraphic) {
        if (showGraphic) {
            dataProtectedSection.style.display = 'none';
            if (dadosDetalhadosTitle) dadosDetalhadosTitle.style.display = 'none';
            canvas.style.display = 'block';
        } else {
            canvas.style.display = 'none';
            dataProtectedSection.style.display = 'block';
            if (dadosDetalhadosTitle) dadosDetalhadosTitle.style.display = 'block';
        }
    }

    if (mostrarGraficoButton) {
        mostrarGraficoButton.addEventListener('click', () => {
            toggleSections(true);
            const filtro = document.getElementById('filtro').value;
            updateGraphic(filtro);
        });
    }

    if (mostrarDetalhesButton) {
        mostrarDetalhesButton.addEventListener('click', () => {
            toggleSections(false);
        });
    }

    async function updateGraphic(filter) {
        const canvas = document.getElementById('myChart');
        if (!canvas) return;

        try {
            const response = await fetch(`https://project-tea.onrender.com/percentage?filter=${encodeURIComponent(filter)}`);
            const data = await response.json();
            let labels = [];
            let datasets = [];

            if (filter === 'todos') {
                let totalSim = 0;
                let totalNao = 0;
                data.forEach(item => {
                    const valor = item.percentage ? parseFloat(item.percentage) : 0;
                    if (item.temEsgotoAi === 'Sim') {
                        totalSim += valor;
                    } else if (item.temEsgotoAi === 'Nao' || item.temEsgotoAi === 'Não') {
                        totalNao += valor;
                    }
                });

                labels = ['Sim', 'Não'];
                datasets = [
                    {
                        label: '% Sim',
                        data: [totalSim, 0],
                        backgroundColor: '#006400'
                    },
                    {
                        label: '% Não',
                        data: [0, totalNao],
                        backgroundColor: '#950606'
                    }
                ];
            } else {
                const nomes = [...new Set(data.map(d => d.nome))];

                const temSim = nomes.map(nome => {
                    const item = data.find(d => d.nome === nome && (d.temEsgotoAi === 'Sim'));
                    return item ? parseFloat(item.percentage) : 0;
                });

                const temNao = nomes.map(nome => {
                    const item = data.find(d => d.nome === nome && (d.temEsgotoAi === 'Nao' || d.temEsgotoAi === 'Não'));
                    return item ? parseFloat(item.percentage) : 0;
                });

                labels = nomes;
                datasets = [
                    {
                        label: '% Sim',
                        data: temSim,
                        backgroundColor: '#006400'
                    },
                    {
                        label: '% Não',
                        data: temNao,
                        backgroundColor: '#950606'
                    }
                ];
            }

            const ctx = canvas.getContext('2d');
            if (window.graphic) window.graphic.destroy();

            window.graphic = new Chart(ctx, {
                type: 'bar',
                data: { labels, datasets },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100,
                            title: { display: true, text: '% de Respostas' }
                        },
                        x: {
                            title: {
                                display: true,
                                text: filter === 'bairro' ? 'Bairro' : filter === 'rua' ? 'Rua' : 'Resposta'
                            }
                        }
                    },
                    plugins: {
                        legend: { display: true },
                        title: { display: true, text: 'Porcentagem de Respostas' }
                    }
                }
            });
        } catch (error) {
            console.error('Erro ao buscar dados:', error);
        }
    }

    document.querySelectorAll('input[name="sexo"]').forEach((radio) => {
        radio.addEventListener('change', verificarOutros);
    });

    document.querySelectorAll('input[name="temEsgotoAi"]').forEach((radio) => {
        radio.addEventListener('change', verificarEsgoto);
    });

    const showDetailButton = document.getElementById('showDetail');
    if (showDetailButton) {
        showDetailButton.addEventListener('click', () => {
            document.getElementById('screen-login').style.display = 'block';
            document.getElementById('detail').style.display = 'none';
            document.getElementById('msg-error').textContent = '';
        });
    }

    document.getElementById('btt-login').addEventListener('click', async () => {
        const user = document.getElementById('user').value;
        const password = document.getElementById('password').value;

        const res = await fetch('/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ username: user, password })
        });

        const data = await res.json();

        if (data.success) {
            document.getElementById('screen-login').style.display = 'none';
            document.getElementById('detail').style.display = 'block';
            loadProtectedData();
            checkLogin();
        } else {
            document.getElementById('msg-error').textContent = 'Usuário ou senha inválidos';
        }
    });

    async function loadProtectedData() {
        try {
            console.log('Carregando dados protegidos...');
            const res = await fetch('/dataProtected', {
                credentials: 'include'
            });

            if (!res.ok) {
                console.error('Erro na resposta da API:', res.status, res.statusText);
                throw new Error('Falha ao carregar dados protegidos.');
            }

            const data = await res.json();
            console.log('Dados recebidos da API:', data);

            const container = document.getElementById('dataProtected');
            container.innerHTML = '';

            if (data.length === 0) {
                container.textContent = 'Nenhum dado encontrado.';
                return;
            }

            const table = document.createElement('table');
            table.style.borderCollapse = 'collapse';
            table.style.width = '100%';
            table.style.marginTop = '20px';

            const styleCell = (cell) => {
                cell.style.border = '1px solid black';
                cell.style.padding = '8px';
                cell.style.textAlign = 'left';
            };

            const headerRow = document.createElement('tr');
            Object.keys(data[0]).forEach(key => {
                const th = document.createElement('th');
                th.textContent = key;
                styleCell(th);
                th.style.backgroundColor = '#f2f2f2';
                headerRow.appendChild(th);
            });
            table.appendChild(headerRow);

            data.forEach(pessoa => {
                const row = document.createElement('tr');
                Object.values(pessoa).forEach(value => {
                    const td = document.createElement('td');
                    td.textContent = value;
                    styleCell(td);
                    row.appendChild(td);
                });
                table.appendChild(row);
            });

            container.appendChild(table);
        } catch (error) {
            console.error('Erro ao carregar dados protegidos:', error);
            const container = document.getElementById('dataProtected');
            container.innerHTML = '<p>Erro ao carregar os dados. Tente novamente mais tarde.</p>';
        }
    }

function verificarOutros() {
    const radios = document.getElementsByName("sexo");
    const inputOutros = document.getElementById('outroSexos');
    let selecionado = "";
    for (let i = 0; i < radios.length; i++) {
        if (radios[i].checked) {
            selecionado = radios[i].value;
            break;
        }
    }

    if (selecionado === "outroSexo") {
        inputOutros.disabled = false;
        inputOutros.focus();
    } else {
        inputOutros.value = "";
        inputOutros.disabled = true;
    }
};

function verificarEsgoto() {
    const esgoto = document.querySelector('input[name="temEsgotoAi"]:checked')?.value;
    const naoTemEsgoto = document.getElementById('opcoes');
    naoTemEsgoto.innerHTML = '<option value="" disabled selected>Selecione uma opção</option>';

    if (esgoto === 'Sim') {
        const option = document.createElement('option');
        option.value = 'NoSistemaDeEsgoto';
        option.text = 'No Sistema de esgoto';
        naoTemEsgoto.appendChild(option);
    } else if (esgoto === 'Nao') {
        const opcaoNao = [
            { value: 'NoMar', text:'No Mar'},
            { value: 'CeuAberto', text:'Ceu Aberto'},
            { value: 'NoMangue', text: 'No Mangue'}
        ];
        opcaoNao.forEach((opt) => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.text = opt.text;
            naoTemEsgoto.appendChild(option);
        })
    }
};

function formatarCelular(telefone) {
    telefone = telefone.replace(/\D/g, '');
    
    if (telefone.length === 11) {
        return telefone.replace(/(\d{2})(\d{1})(\d{4})(\d{4})/, '($1) $2$3-$4');
    } else {
        return 'Número inválido';
    }
};

async function checkLogin() {
    const res = await fetch('/check-login');
    const data = await res.json();
    if (data.logado){
        document.getElementById('area-restrita').style.display = 'block';
    }
};

checkLogin();

function downloadPDF() {
    window.location.href = '/document.pdf';
};

});