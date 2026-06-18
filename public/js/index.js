document.addEventListener('DOMContentLoaded', () => {
    const bttShowGraph = document.getElementById('mostrarGraficoButton');
    const canvas = document.getElementById('myChart');
    const form = document.getElementById('formPessoas'); 

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const formData = new FormData(form);
            const allData = Object.fromEntries(formData.entries());

            try {
                const response = await fetch('https://project-tea.onrender.com/form', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(allData),
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

    if (canvas) canvas.style.display = 'none';

    if (bttShowGraph) {
        bttShowGraph.addEventListener('click', () => {
            const filter = document.getElementById('filtro').value;
            updateGraphic(filter);
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
                    maintainAspectRatio: false,
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
        radio.addEventListener('change', validateGender);
    });

    document.querySelectorAll('input[name="temEsgotoAi"]').forEach((radio) => {
        radio.addEventListener('change', validateSewage);
    });

    

    function validateGender() {
        const radios = document.getElementsByName("sexo");
        const inputOthers = document.getElementById('outroSexos');
        let selecionado = "";
        for (let i = 0; i < radios.length; i++) {
            if (radios[i].checked) {
                selecionado = radios[i].value;
                break;
            }
        }

        if (selecionado === "outroSexo") {
            inputOthers.disabled = false;
            inputOthers.focus();
        } else {
            inputOthers.disabled = true;
            inputOthers.value = "";
        }
        inputOthers.addEventListener('input', () => {
        inputOthers.value = inputOthers.value.replace(/[0-9]/g, '');
    });
        document.querySelectorAll('input[name="sexo"]').forEach((radio) => {
        radio.addEventListener('change', validateGender);
    });
    };

    function validateSewage() {
        const sewage = document.querySelector('input[name="temEsgotoAi"]:checked')?.value;
        const notSewage = document.getElementById('opcoes');
        notSewage.innerHTML = '<option value="" disabled selected>Selecione uma opção</option>';

        if (sewage === 'Sim') {
            const option = document.createElement('option');
            option.value = 'NoSistemaDeEsgoto';
            option.text = 'No Sistema de esgoto';
            notSewage.appendChild(option);
        } else if (sewage === 'Nao') {
            const optionNot = [
                { value: 'NoMar', text:'No Mar'},
                { value: 'CeuAberto', text:'Ceu Aberto'},
                { value: 'NoMangue', text: 'No Mangue'}
            ];
            optionNot.forEach((opt) => {
                const option = document.createElement('option');
                option.value = opt.value;
                option.text = opt.text;
                notSewage.appendChild(option);
            })
        }
        document.querySelectorAll('input[name="temEsgotoAi"]').forEach((radio) => {
        radio.addEventListener('change', validateSewage); 
    });
    };
});