const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;
const DRAG = 1;
const GRAVITY = 0.4;
const THRUST = 1;
const TARGET_ROTATION_SPEED = Math.PI / 180 * 2;
const ROTATION_ACCELERATION = Math.PI / 180 * 0.1;
const MAX_FIRE_ANGLE = Math.PI / 6;
const POPULATION_SIZE = 500;
const CENTER_MARGIN = 1;
const LIFESPAN = 1000; // Number of frames for each generation
const COLLECTION_RADIUS = 10; // Radius of the collection area
const MOVEMENT_PENALTY = 0.2; // Penalty for unnecessary movements
const ANGLE_TOLERANCE = Math.PI / 36; // Approximately 5 degrees
const DISTANCE_WEIGHT = 1; // Weight for current distance
const BEST_DISTANCE_WEIGHT = 0.3; // Weight for best distance achieved
const STABILIZATION_TIME = 60; // 60 frames (~1 second at 60 FPS)
const STABILIZATION_BONUS = 1000; // Points for stabilizing for required time
const MAX_COLLECTIONS = 5; // Maximum collections per rocket for visualization purposes
const COLLECTION_MAX_SPEED = 5; // Velocidade máxima da coleta
const COLLECTION_ACCELERATION = 0.1; // Taxa de aceleração da coleta
const SUDDEN_MOVEMENT_CHANCE = 0.02; // Chance de movimento brusco a cada frame
const VS_AI_SPEED_FACTOR = 0.5;

// Game state
let canvas, ctx, images, rockets, neat, generation, currentFrame, bestFitness;
let savedGenome = null; // Armazenar o melhor genome
let playMode = false;   // Modo de jogo: treinamento ou play
let singleRocket = null; // Foguete único para o play mode
let isMuted = true;
let accelerationFactor = 1;
let playerRocket = null;
let aiRocket = null;
let gameMode = 'training'; // 'training' ou 'vsAI'
let countdownTimer = 3;
let centerTime = { player: 0, ai: 0 };
let isTraining = true;
const WIN_TIME = 20 * 60; // 20 segundos a 60 FPS

window.onload = function() {
    initializeGame();
    setupControls();
    gameMode = 'training'; // Certifique-se de que o jogo começa no modo de treinamento
    // O gameLoop será iniciado após todas as imagens serem carregadas
};

function toggleMute() {
    isMuted = !isMuted;
    window.rocketSound.muted = isMuted;
    document.getElementById('muteBtn').textContent = isMuted ? 'Unmute' : 'Mute';
    console.log('Mute toggled. isMuted:', isMuted); // Log para debug
}

function setupVsAIMode() {
    // Criar foguete do jogador
    playerRocket = createPlayerRocket();
    
    // Criar foguete da IA usando o melhor genome
    aiRocket = createAIRocket(savedGenome);
    
    if (!playerRocket || !aiRocket) {
        console.error('Failed to create rockets');
        return;
    }
    
    // Posicionar os foguetes lado a lado
    positionRockets();
    
    // Resetar tempos no centro
    centerTime = { player: 0, ai: 0 };

    // Logs para debug
    console.log('Player Rocket:', playerRocket.x, playerRocket.y);
    console.log('AI Rocket:', aiRocket.x, aiRocket.y);
}

function startPlayAgainstAI() {
    if (isTraining) {
        isTraining = false; // Parar o treinamento
        gameMode = 'vsAI';
        saveBestGenome();
        if (!savedGenome) {
            console.error('No saved genome available');
            return;
        }
        setupVsAIMode();
        startCountdown();
    }
}

function updateCollectionPosition(deltaTime) {
    const collection = window.centralCollection;
    const CENTER_MARGIN = 0.2; // 20% de margem nas bordas

    // Chance de movimento brusco
    if (Math.random() < SUDDEN_MOVEMENT_CHANCE) {
        collection.targetSpeedX = (Math.random() - 0.5) * COLLECTION_MAX_SPEED * 2;
        collection.targetSpeedY = (Math.random() - 0.5) * COLLECTION_MAX_SPEED * 2;
    }

    // Acelerar gradualmente em direção à velocidade alvo
    collection.speedX += (collection.targetSpeedX - collection.speedX) * COLLECTION_ACCELERATION;
    collection.speedY += (collection.targetSpeedY - collection.speedY) * COLLECTION_ACCELERATION;

    // Limitar a velocidade máxima
    collection.speedX = Math.max(-COLLECTION_MAX_SPEED, Math.min(COLLECTION_MAX_SPEED, collection.speedX));
    collection.speedY = Math.max(-COLLECTION_MAX_SPEED, Math.min(COLLECTION_MAX_SPEED, collection.speedY));

    // Atualizar posição
    collection.x += collection.speedX * deltaTime;
    collection.y += collection.speedY * deltaTime;

    // Verificar colisão com as bordas e inverter direção se necessário
    if (collection.x <= CANVAS_WIDTH * CENTER_MARGIN || 
        collection.x >= CANVAS_WIDTH * (1 - CENTER_MARGIN) - collection.width) {
        collection.speedX *= -1;
        collection.targetSpeedX *= -1;
    }

    if (collection.y <= CANVAS_HEIGHT * CENTER_MARGIN || 
        collection.y >= CANVAS_HEIGHT * (1 - CENTER_MARGIN) - collection.height) {
        collection.speedY *= -1;
        collection.targetSpeedY *= -1;
    }

    // Manter dentro dos limites
    collection.x = Math.max(CANVAS_WIDTH * CENTER_MARGIN, 
                   Math.min(collection.x, CANVAS_WIDTH * (1 - CENTER_MARGIN) - collection.width));
    collection.y = Math.max(CANVAS_HEIGHT * CENTER_MARGIN, 
                   Math.min(collection.y, CANVAS_HEIGHT * (1 - CENTER_MARGIN) - collection.height));
}

function createPlayerRocket() {
    const rocket = {
        x: CANVAS_WIDTH / 4,
        y: CANVAS_HEIGHT / 2,
        speedX: 0,
        speedY: 0,
        angle: 0,
        width: 450,
        height: 280,
        thrusting: false,
        active: true,
        fireAngle: 0
    };
    console.log('Created player rocket:', rocket);
    return rocket;
}

function createAIRocket(genome) {
    if (!genome) {
        console.error('No genome provided for AI rocket');
        return null;
    }
    const rocket = {
        x: (CANVAS_WIDTH * 3) / 4,
        y: CANVAS_HEIGHT / 2,
        speedX: 0,
        speedY: 0,
        angle: 0,
        width: 450,
        height: 280,
        brain: genome,
        thrusting: false,
        active: true,
        fireAngle: 0
    };
    console.log('Created AI rocket:', rocket);
    return rocket;
}

function positionRockets() {
    const margin = 500; // Margem de segurança
    
    playerRocket.x = CANVAS_WIDTH / 4;
    playerRocket.y = CANVAS_HEIGHT / 2;
    
    aiRocket.x = (CANVAS_WIDTH * 3) / 4;
    aiRocket.y = CANVAS_HEIGHT / 2;
    
    // Ajustar posições para garantir que estejam dentro do campo
    playerRocket.x = Math.max(margin, Math.min(playerRocket.x, CANVAS_WIDTH - playerRocket.width - margin));
    playerRocket.y = Math.max(margin, Math.min(playerRocket.y, CANVAS_HEIGHT - playerRocket.height - margin));
    
    aiRocket.x = Math.max(margin, Math.min(aiRocket.x, CANVAS_WIDTH - aiRocket.width - margin));
    aiRocket.y = Math.max(margin, Math.min(aiRocket.y, CANVAS_HEIGHT - aiRocket.height - margin));
    
    // Resetar velocidades e ângulos
    playerRocket.speedX = 0;
    playerRocket.speedY = 0;
    playerRocket.angle = 0;
    playerRocket.fireAngle = 0;
    
    aiRocket.speedX = 0;
    aiRocket.speedY = 0;
    aiRocket.angle = 0;
    aiRocket.fireAngle = 0;

    console.log('After positioning - Player:', playerRocket.x, playerRocket.y);
    console.log('After positioning - AI:', aiRocket.x, aiRocket.y);
}

function evolve() {
    if (playMode) return; // Não evoluir no modo Play

    // Stop all rocket sounds
    window.rocketSound.pause();
    window.rocketSound.currentTime = 0;

    // Ordenar foguetes por fitness decrescente
    rockets.sort((a, b) => b.fitness - a.fitness);

    const bestRocket = rockets[0];
    console.log(`Geração ${generation}: Melhor fitness: ${bestRocket.fitness.toFixed(2)}, Melhor distância: ${bestRocket.bestDistance.toFixed(2)}`);

    // Evoluir a população
    neat.sort();
    const newPopulation = [];

    // Elitismo: manter os melhores indivíduos
    for (let i = 0; i < neat.elitism; i++) {
        newPopulation.push(neat.population[i]);
    }

    // Criar o restante da nova população
    for (let i = 0; i < neat.popsize - neat.elitism; i++) {
        newPopulation.push(neat.getOffspring());
    }

    // Substituir a antiga população pela nova
    neat.population = newPopulation;
    neat.mutate();

    // Reset para a próxima geração
    generation++;
    currentFrame = 0; // Resetar contador de frames
    bestFitness = 0;
    rockets = createRockets();
}

function startCountdown() {
    countdownTimer = 3;
    const countdownElement = document.getElementById('countdown');
    countdownElement.style.display = 'block';
    
    const countdownInterval = setInterval(() => {
        countdownElement.textContent = countdownTimer;
        countdownTimer--;
        
        if (countdownTimer < 0) {
            clearInterval(countdownInterval);
            countdownElement.style.display = 'none';
            // Iniciar o jogo após a contagem regressiva
            startGame();
        }
    }, 1000);
}

function startGame() {
    // Resetar posições e estados dos foguetes
    positionRockets();
    playerRocket.active = true;
    aiRocket.active = true;
    
    // Iniciar o loop do jogo
    gameLoop();
}

function updateVsAIMode() {
    const deltaTime = VS_AI_SPEED_FACTOR;

    updatePlayerRocket(deltaTime);
    updateAIRocket(deltaTime);
    updateCollectionPosition(deltaTime);
    checkWinCondition();

    // Verificar se as posições se tornaram NaN
    if (isNaN(playerRocket.x) || isNaN(playerRocket.y) || isNaN(aiRocket.x) || isNaN(aiRocket.y)) {
        console.error('Rocket positions became NaN');
        console.log('Player:', playerRocket);
        console.log('AI:', aiRocket);
        // Resetar as posições se necessário
        positionRockets();
    }
}

function endGame(winner) {
    gameMode = 'training';
    const message = winner === 'player' ? 'Você venceu!' : 'A IA venceu!';
    alert(message);
    resetTraining();
}

function updatePlayerRocket(deltaTime) {
    if (!playerRocket || !playerRocket.active) return;

    const previousThrusting = playerRocket.thrusting;
    playerRocket.thrusting = keys.ArrowUp;

    if (playerRocket.thrusting) {
        playerRocket.speedX += THRUST * Math.sin(playerRocket.angle) * deltaTime;
        playerRocket.speedY -= THRUST * Math.cos(playerRocket.angle) * deltaTime;
    }

    if (keys.ArrowLeft) {
        playerRocket.angle -= TARGET_ROTATION_SPEED * deltaTime;
        playerRocket.fireAngle = Math.min(playerRocket.fireAngle + 0.1 * deltaTime, MAX_FIRE_ANGLE);
    } else if (keys.ArrowRight) {
        playerRocket.angle += TARGET_ROTATION_SPEED * deltaTime;
        playerRocket.fireAngle = Math.max(playerRocket.fireAngle - 0.1 * deltaTime, -MAX_FIRE_ANGLE);
    } else {
        playerRocket.fireAngle += (0 - playerRocket.fireAngle) * 0.1 * deltaTime;
    }

    // Verificar se as novas posições são válidas antes de atualizar
    const newX = playerRocket.x + playerRocket.speedX * deltaTime;
    const newY = playerRocket.y + playerRocket.speedY * deltaTime;

    if (!isNaN(newX) && !isNaN(newY)) {
        playerRocket.x = newX;
        playerRocket.y = newY;
    } else {
        console.error('Invalid player position calculated');
    }

    // Aplicar arrasto e gravidade
    playerRocket.speedX *= Math.pow(DRAG, deltaTime);
    playerRocket.speedY += GRAVITY * deltaTime;

    // Manter o foguete dentro dos limites
    keepRocketInBounds(playerRocket);
}

function checkWinCondition() {
    if (isInCollectionArea(playerRocket)) {
        centerTime.player++;
    } else {
        centerTime.player = 0;
    }
    
    if (isInCollectionArea(aiRocket)) {
        centerTime.ai++;
    } else {
        centerTime.ai = 0;
    }
    
    if (centerTime.player >= WIN_TIME) {
        endGame('player');
    } else if (centerTime.ai >= WIN_TIME) {
        endGame('ai');
    }
}

// Adicione esta variável global para controlar as teclas pressionadas
const keys = {};
// Adicione estes event listeners para capturar as teclas pressionadas
window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
});

window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

function drawPlayerRocket() {
    ctx.save();
    ctx.translate(playerRocket.x + playerRocket.width / 2, playerRocket.y + playerRocket.height / 2);
    ctx.rotate(playerRocket.angle);
    ctx.drawImage(images.rocket, -playerRocket.width / 2, -playerRocket.height / 2, playerRocket.width, playerRocket.height);
    ctx.restore();
}

function drawAIRocket() {
    ctx.save();
    ctx.translate(aiRocket.x + aiRocket.width / 2, aiRocket.y + aiRocket.height / 2);
    ctx.rotate(aiRocket.angle);
    ctx.drawImage(images.rocket, -aiRocket.width / 2, -aiRocket.height / 2, aiRocket.width, aiRocket.height);
    ctx.restore();
}

function drawVsAIInfo() {
    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.fillText(`Tempo no centro - Jogador: ${(centerTime.player / 60).toFixed(1)}s`, 10, 30);
    ctx.fillText(`Tempo no centro - IA: ${(centerTime.ai / 60).toFixed(1)}s`, 10, 60);
}

// Adicione estes event listeners para capturar as teclas pressionadas
window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
});

window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

function gameLoop() {
    if (isTraining) {
        // Lógica de treinamento existente
        const allInactive = allRocketsInactive();

        if ((currentFrame >= LIFESPAN || allInactive) && !playMode) {
            if (currentFrame >= LIFESPAN) {
                console.log(`Geração encerrada. Motivo: LIFESPAN alcançado`);
            } else {
                console.log(`Geração encerrada. Motivo: Todos os foguetes inativos`);
            }

            // Final evaluation of the generation
            const bestRocket = rockets.reduce((best, current) => 
                current.fitness > best.fitness ? current : best
            );
            console.log(`Geração ${generation}: Melhor fitness: ${bestRocket.fitness.toFixed(2)}, Melhor distância: ${bestRocket.bestDistance.toFixed(2)}, Coletas: ${bestRocket.collectionsReached}`);
            console.log(`Geração ${generation}: Melhor fitness: ${bestRocket.fitness.toFixed(2)}, Melhor distância: ${bestRocket.bestDistance.toFixed(2)}`);

            evolve(); // Evolve to the next generation

        } else if (!playMode) {
            for (let i = 0; i < accelerationFactor; i++) {
                updateCollectionPosition(1); // Use 1 como deltaTime para velocidade normal
                updateRockets(1); // Use 1 como deltaTime para velocidade normal
                currentFrame++;
                
                if (currentFrame >= LIFESPAN || allRocketsInactive()) {
                    break;
                }
            }
            draw(); // Certifique-se de que a função draw() é chamada
        } else if (playMode && singleRocket) {
            updateCollectionPosition();
            updateRockets();
            draw();
            currentFrame++;
        }
    } else if (gameMode === 'vsAI') {
        if (playerRocket && aiRocket) {
            updateVsAIMode();
            // Verificar novamente se as posições são válidas
            if (isNaN(playerRocket.x) || isNaN(playerRocket.y) || isNaN(aiRocket.x) || isNaN(aiRocket.y)) {
                console.error('Invalid rocket positions before drawing');
                positionRockets(); // Resetar posições se necessário
            }
            draw();
        } else {
            console.error('Rockets not initialized in gameLoop');
        }
    }
    
    requestAnimationFrame(gameLoop);
}


function toggleAcceleration() {
    if (accelerationFactor === 1) {
        accelerationFactor = 10;
        document.getElementById('accelerateBtn').textContent = 'Desacelerar';
    } else {
        accelerationFactor = 1;
        document.getElementById('accelerateBtn').textContent = 'Acelerar Treinamento';
    }
}

function allRocketsInactive() {
    if (playMode && singleRocket) {
        return !singleRocket.active;
    }
    return rockets.every(rocket => !rocket.active);
}

function loadImage(src) {
    const img = new Image();
    img.src = src;
    return img;
}

function initializeGame() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    
    images = {
        rocket: loadImage('foguete.png'),
        fire: loadImage('fire.png'),
        background: loadImage('fundo.png'),
        ship: loadImage('navio.png'),
        collection: loadImage('coleta.png')
    };

    const centralCollection = {
        x: (CANVAS_WIDTH - 150) / 2,
        y: (CANVAS_HEIGHT - 150) / 2,
        width: 350,
        height: 260,
        speedX: (Math.random() - 0.5) * 2,
        speedY: (Math.random() - 0.5) * 2,
        targetSpeedX: 0,
        targetSpeedY: 0
    };
    window.centralCollection = centralCollection;

    // Inicializar NEAT
    neat = new neataptic.Neat(
        11, // Número de nós de entrada
        3,  // Número de nós de saída
        null,
        {
            mutation: neataptic.methods.mutation.ALL,
            popsize: POPULATION_SIZE,
            elitism: Math.round(0.1 * POPULATION_SIZE),
            network: new neataptic.architect.Perceptron(11, 10, 3) // Ajuste do tamanho da camada de entrada
        }
    );

    // Carregar o som do foguete
    window.rocketSound = new Audio('rocket sound.wav');
    window.rocketSound.loop = true;
    window.rocketSound.volume = 1;
    window.rocketSound.muted = true;  // Iniciar mutado

    // Esperar todas as imagens carregarem antes de iniciar o game loop
    let imagesLoaded = 0;
    const totalImages = Object.keys(images).length;

    for (let key in images) {
        images[key].onload = () => {
            imagesLoaded++;
            if (imagesLoaded === totalImages) {
                resetSimulation();
                gameLoop(); // Iniciar o loop do jogo
            }
        };
        images[key].onerror = () => {
            console.error(`Erro ao carregar a imagem: ${images[key].src}`);
        };
    }
}

function resetTraining() {
    // Stop all rocket sounds
    window.rocketSound.pause();
    window.rocketSound.currentTime = 0;

    playMode = false;
    savedGenome = null;
    singleRocket = null;
    generation = 0;
    currentFrame = 0;
    bestFitness = 0;
    rockets = createRockets();
}

function resetSimulation() {
    generation = 0;
    currentFrame = 0;
    bestFitness = 0;
    rockets = createRockets();
}

function createRockets() {
    // Gerar uma posição aleatória única para toda a geração
    const spawnX = Math.random() * (CANVAS_WIDTH - 450);
    const spawnY = Math.random() * (CANVAS_HEIGHT - 280);

    if (playMode && savedGenome) {
        // Modo Play: apenas um foguete com o genome salvo
        const genomeCopy = savedGenome.clone(); // Clonar para garantir independência
        return [{
            x: spawnX,
            y: spawnY,
            speedX: 0,
            speedY: 0,
            angle: 0,
            currentFitness: 0,
            fireAngle: 0,
            width: 450,
            height: 280,
            fitness: 0,
            bestDistance: Infinity,
            collectionsReached: 0, // Inicializar
            brain: genomeCopy,
            thrusting: false,
            active: true,
            lifetime: 0
        }];
    }

    return neat.population.map(genome => {
        return {
            x: spawnX,
            y: spawnY,
            speedX: 0,
            speedY: 0,
            angle: 0,
            fireAngle: 0,
            width: 450,
            height: 280,
            fitness: 0,
            currentFitness: 0,
            bestDistance: Infinity,
            collectionsReached: 0, // Inicializar
            brain: genome,
            thrusting: false,
            active: true,
            lifetime: 0
        };
    });
}

function saveBestGenome() {
    if (rockets.length === 0) {
        console.error('No rockets to save genome from');
        return;
    }
    const bestRocket = rockets.reduce((best, current) => 
        current.currentFitness > best.currentFitness ? current : best
    );
    savedGenome = bestRocket.brain; // Salva o genome
    console.log(`Melhor fitness atual salvo: ${bestRocket.currentFitness.toFixed(2)}`);
}

function switchToPlayMode() {
    if (!savedGenome) return;
    playMode = true;
    singleRocket = rockets[0]; // Apenas o primeiro foguete é usado no play mode
    console.log('Modo Play ativado com o melhor foguete!');
}

function calculateFitness(rocket) {
    const rocketCenterX = rocket.x + rocket.width / 2;
    const rocketCenterY = rocket.y + rocket.height / 2;
    const collectCenterX = window.centralCollection.x + window.centralCollection.width / 2;
    const collectCenterY = window.centralCollection.y + window.centralCollection.height / 2;

    const distance = Math.sqrt(
        Math.pow(collectCenterX - rocketCenterX, 2) +
        Math.pow(collectCenterY - rocketCenterY, 2)
    );

    // Calcular fitness inversamente proporcional à distância
    // Fitness máximo de 1000 quando distance = 0
    // Decai exponencialmente conforme a distância aumenta
    const instantFitness = 1000 * Math.exp(-distance / 100); // Ajuste o divisor para controlar a taxa de decaimento

    return instantFitness;
}

function updateAIRocket(deltaTime) {
    if (!aiRocket || !aiRocket.active) return;

    const inputs = calculateNeuralInputs(aiRocket);
    const outputs = aiRocket.brain.activate(inputs);

    const previousThrusting = aiRocket.thrusting;
    aiRocket.thrusting = outputs[0] > 0.5;

    if (aiRocket.thrusting) {
        aiRocket.speedX += THRUST * Math.sin(aiRocket.angle) * deltaTime;
        aiRocket.speedY -= THRUST * Math.cos(aiRocket.angle) * deltaTime;
    }

    if (outputs[1] > 0.5) { // Rotate left
        aiRocket.angle -= TARGET_ROTATION_SPEED * deltaTime;
        aiRocket.fireAngle = Math.min(aiRocket.fireAngle + 0.1 * deltaTime, MAX_FIRE_ANGLE);
    } else if (outputs[2] > 0.5) { // Rotate right
        aiRocket.angle += TARGET_ROTATION_SPEED * deltaTime;
        aiRocket.fireAngle = Math.max(aiRocket.fireAngle - 0.1 * deltaTime, -MAX_FIRE_ANGLE);
    } else {
        aiRocket.fireAngle += (0 - aiRocket.fireAngle) * 0.1 * deltaTime;
    }

    // Verificar se as novas posições são válidas antes de atualizar
    const newX = aiRocket.x + aiRocket.speedX * deltaTime;
    const newY = aiRocket.y + aiRocket.speedY * deltaTime;

    if (!isNaN(newX) && !isNaN(newY)) {
        aiRocket.x = newX;
        aiRocket.y = newY;
    } else {
        console.error('Invalid AI position calculated');
    }

    // Aplicar arrasto e gravidade
    aiRocket.speedX *= Math.pow(DRAG, deltaTime);
    aiRocket.speedY += GRAVITY * deltaTime;

    // Manter o foguete dentro dos limites
    keepRocketInBounds(aiRocket);
}

function updateRockets(deltaTime) {
    rockets.forEach((rocket, index) => {
        if (!rocket.active) return;

        rocket.lifetime++;

        const inputs = calculateNeuralInputs(rocket);
        const outputs = rocket.brain.activate(inputs);
        
        applyNetworkOutputs(rocket, outputs, deltaTime, index);
        updatePosition(rocket, deltaTime);
        keepRocketInBounds(rocket);

        const currentDistance = calculateDistanceToTarget(rocket);

        if (currentDistance < rocket.bestDistance) {
            rocket.bestDistance = currentDistance;
        }

        rocket.currentFitness = calculateFitness(rocket);
        rocket.fitness = Math.max(rocket.fitness, rocket.currentFitness); // Mantém o melhor fitness alcançado
        rocket.brain.score = rocket.fitness;
        
        //bestFitness = Math.max(bestFitness, rocket.fitness);

        // Verificar se está na área de coleta e incrementar
        if (isInCollectionArea(rocket)) {
            rocket.collectionsReached++;
            // Opcional: desativar o foguete após alcançar a coleta
            // rocket.active = false;
        }
    });
}

function setupControls() {
    const resetBtn = document.getElementById('resetBtn');
    const muteBtn = document.getElementById('muteBtn');
    const accelerateBtn = document.getElementById('accelerateBtn');
    const playAgainstAIBtn = document.getElementById('playAgainstAIBtn');

    resetBtn.addEventListener('click', () => {
        resetTraining();
    });

    muteBtn.addEventListener('click', toggleMute);

    accelerateBtn.addEventListener('click', toggleAcceleration);

    playAgainstAIBtn.addEventListener('click', startPlayAgainstAI);
}

function calculateDistanceToTarget(rocket) {
    const rocketCenterX = rocket.x + rocket.width / 2;
    const rocketCenterY = rocket.y + rocket.height / 2;
    const targetCenterX = window.centralCollection.x + window.centralCollection.width / 2;
    const targetCenterY = window.centralCollection.y + window.centralCollection.height / 2;

    return Math.sqrt(
        Math.pow(targetCenterX - rocketCenterX, 2) +
        Math.pow(targetCenterY - rocketCenterY, 2)
    );
}

function isInCollectionArea(rocket) {
    const rocketCenterX = rocket.x + rocket.width / 2;
    const rocketCenterY = rocket.y + rocket.height / 2;
    const targetCenterX = window.centralCollection.x + window.centralCollection.width / 2;
    const targetCenterY = window.centralCollection.y + window.centralCollection.height / 2;

    const distance = Math.sqrt(
        Math.pow(targetCenterX - rocketCenterX, 2) +
        Math.pow(targetCenterY - rocketCenterY, 2)
    );

    return distance < COLLECTION_RADIUS;
}

function calculateNeuralInputs(rocket) {
    const rocketCenterX = rocket.x + rocket.width / 2;
    const rocketCenterY = rocket.y + rocket.height / 2;
    const targetCenterX = window.centralCollection.x + window.centralCollection.width / 2;
    const targetCenterY = window.centralCollection.y + window.centralCollection.height / 2;

    // Normalized distance to target (X and Y components)
    const distanceX = (targetCenterX - rocketCenterX) / CANVAS_WIDTH;
    const distanceY = (targetCenterY - rocketCenterY) / CANVAS_HEIGHT;

    // Normalized velocity
    const velocityX = rocket.speedX / 10; // Assume max speed is 10
    const velocityY = rocket.speedY / 10;

    // Normalized angle to target
    const angleToTarget = Math.atan2(targetCenterY - rocketCenterY, targetCenterX - rocketCenterX);
    const normalizedAngleToTarget = angleToTarget / (2 * Math.PI);

    // Normalized rocket angle
    const normalizedRocketAngle = (rocket.angle % (2 * Math.PI)) / (2 * Math.PI);

    // Difference between rocket angle and angle to target
    let angleDifference = normalizedAngleToTarget - normalizedRocketAngle;
    angleDifference = Math.atan2(Math.sin(angleDifference), Math.cos(angleDifference)); // Normalize to (-PI, PI)

    // Distance to nearest wall
    const distanceToLeftWall = rocket.x / CANVAS_WIDTH;
    const distanceToRightWall = (CANVAS_WIDTH - (rocket.x + rocket.width)) / CANVAS_WIDTH;
    const distanceToTopWall = rocket.y / CANVAS_HEIGHT;
    const distanceToBottomWall = (CANVAS_HEIGHT - (rocket.y + rocket.height)) / CANVAS_HEIGHT;

    return [
        distanceX,
        distanceY,
        velocityX,
        velocityY,
        normalizedAngleToTarget,
        normalizedRocketAngle,
        angleDifference,
        distanceToLeftWall,
        distanceToRightWall,
        distanceToTopWall,
        distanceToBottomWall
    ];
}

function applyNetworkOutputs(rocket, outputs, deltaTime, index) {
    const inCollectionArea = isInCollectionArea(rocket);

    const previousThrusting = rocket.thrusting;
    rocket.thrusting = outputs[0] > 0.5;

    if (rocket.thrusting) {
        rocket.speedX += THRUST * Math.sin(rocket.angle) * deltaTime;
        rocket.speedY -= THRUST * Math.cos(rocket.angle) * deltaTime;
    }

    if (outputs[1] > 0.5) { // Rotate left
        rocket.angle -= TARGET_ROTATION_SPEED * deltaTime;
        rocket.fireAngle = Math.min(rocket.fireAngle + 0.1 * deltaTime, MAX_FIRE_ANGLE);
    } else if (outputs[2] > 0.5) { // Rotate right
        rocket.angle += TARGET_ROTATION_SPEED * deltaTime;
        rocket.fireAngle = Math.max(rocket.fireAngle - 0.1 * deltaTime, -MAX_FIRE_ANGLE);
    } else {
        rocket.fireAngle += (0 - rocket.fireAngle) * 0.1 * deltaTime;
    }

    // Add a force to keep the rocket vertical when near the target
    if (inCollectionArea) {
        const angleCorrection = -rocket.angle * 0.1;
        rocket.angle += angleCorrection;
    }
}

function updatePosition(rocket, deltaTime) {
    rocket.x += rocket.speedX * deltaTime;
    rocket.y += rocket.speedY * deltaTime;

    rocket.speedX *= Math.pow(DRAG, deltaTime);
    rocket.speedY += GRAVITY * deltaTime;
}

function keepRocketInBounds(rocket) {
    if (gameMode === 'vsAI') {
        // No modo VS AI, apenas impedir que o foguete saia da tela
        rocket.x = Math.max(0, Math.min(rocket.x, CANVAS_WIDTH - rocket.width));
        rocket.y = Math.max(0, Math.min(rocket.y, CANVAS_HEIGHT - rocket.height));
        
        // Se o foguete atingir uma borda, zerar sua velocidade nessa direção
        if (rocket.x <= 0 || rocket.x >= CANVAS_WIDTH - rocket.width) {
            rocket.speedX = 0;
        }
        if (rocket.y <= 0 || rocket.y >= CANVAS_HEIGHT - rocket.height) {
            rocket.speedY = 0;
        }
    } else {
        // Comportamento original para o modo de treinamento
        if (rocket.x < 0 || rocket.x > CANVAS_WIDTH - rocket.width || 
            rocket.y < 0 || rocket.y > CANVAS_HEIGHT - rocket.height) {
            rocket.active = false;
            rocket.x = Math.max(0, Math.min(rocket.x, CANVAS_WIDTH - rocket.width));
            rocket.y = Math.max(0, Math.min(rocket.y, CANVAS_HEIGHT - rocket.height));
            rocket.speedX = 0;
            rocket.speedY = 0;
        }
    }
}

function draw() {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Desenhar background
    ctx.drawImage(images.background, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Desenhar navio
    ctx.drawImage(images.ship, CANVAS_WIDTH / 2 - 100, CANVAS_HEIGHT - 150, 200, 150);

    if (gameMode === 'training') {
        // Desenhar foguetes primeiro
        rockets.forEach((rocket, index) => {
            ctx.save();
            ctx.translate(rocket.x + rocket.width / 2, rocket.y + rocket.height / 2);
            ctx.rotate(rocket.angle);

            // Desenhar fogo se estiver acelerando
            if (rocket.active && rocket.thrusting) {
                drawFire(rocket);
            }

            // Desenhar foguete
            drawRocket(rocket);

            ctx.restore();
        });

        // Desenhar coleta central depois dos foguetes
        drawCollectionTarget(window.centralCollection);

        // Desenhar informações
        drawInfo();

        // Desenhar rede neural
        if (!playMode && rockets.length > 0) {
            drawNeuralNetwork(rockets[0].brain);
        }

        if (playMode && singleRocket) {
            drawNeuralNetwork(singleRocket.brain);
        }
    }

    if (gameMode === 'vsAI') {
        if (playerRocket && aiRocket) {
            console.log('Drawing - Player:', playerRocket.x, playerRocket.y);
            console.log('Drawing - AI:', aiRocket.x, aiRocket.y);
            drawRocketWithFire(playerRocket);
            drawRocketWithFire(aiRocket);
            drawCollectionTarget(window.centralCollection);
            drawVsAIInfo();
        } else {
            console.log('Rockets not initialized yet');
        }
    }
}

function drawRocketWithFire(rocket) {
    ctx.save();
    ctx.translate(rocket.x + rocket.width / 2, rocket.y + rocket.height / 2);
    ctx.rotate(rocket.angle);

    // Desenhar fogo se estiver acelerando
    if (rocket.thrusting) {
        drawFire(rocket);
    }

    // Desenhar foguete
    ctx.drawImage(images.rocket, -rocket.width / 2, -rocket.height / 2, rocket.width, rocket.height);

    ctx.restore();
}

function drawFire(rocket) {
    ctx.save();
    ctx.translate(0, rocket.height / 7); // Move to the base of the rocket
    ctx.rotate(rocket.fireAngle);
    const fireWidth = images.fire.width * 0.5;
    const fireHeight = images.fire.height * 0.5;
    
    ctx.drawImage(images.fire, -fireWidth / 2, 0, fireWidth, fireHeight);
    ctx.restore();
}

function drawRocket(rocket) {
    if (rocket.active) {
        ctx.globalAlpha = 1.0;
    } else {
        ctx.globalAlpha = 0.3;
    }
    
    ctx.drawImage(images.rocket, -rocket.width / 2, -rocket.height / 2, rocket.width, rocket.height);
    
    ctx.globalAlpha = 1.0;
}

function drawCollectionTarget(target) {
    if (!target) return; // Segurança
    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.drawImage(images.collection, target.x, target.y, target.width, target.height);
    ctx.globalAlpha = 1.0;
    ctx.restore();
}

function drawInfo() {
    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.fillText(`Geração: ${generation}`, 10, 30);
    ctx.fillText(`Frame: ${currentFrame}/${LIFESPAN}`, 10, 60);
    
    // Adicionar informações sobre a melhor distância e fitness atual
    const bestRocket = rockets.reduce((best, current) => current.currentFitness > best.currentFitness ? current : best);
    ctx.fillText(`Melhor Distância: ${bestRocket.bestDistance.toFixed(2)}`, 10, 90);
    ctx.fillText(`Fitness Atual (Melhor Foguete): ${bestRocket.currentFitness.toFixed(2)}`, 10, 120);
    ctx.fillText(`Coletas: ${bestRocket.collectionsReached}`, 10, 150);

    if (currentFrame >= LIFESPAN) {
        ctx.fillStyle = 'red';
        ctx.fillText('Geração encerrada: LIFESPAN alcançado', 10, 180);
    } else if (allRocketsInactive()) {
        ctx.fillStyle = 'red';
        ctx.fillText('Geração encerrada: Todos os foguetes inativos', 10, 180);
    }
}

function drawNeuralNetwork(network) {
    if (!network || !network.nodes) {
        console.error('No network provided to drawNeuralNetwork');
        return;
    }

    const neuronPositions = calculateNeuronPositions(network);
    const layerCount = neuronPositions.length;

    // Draw connections
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.5)';
    ctx.lineWidth = 1;
    network.connections.forEach(conn => {
        const fromIndex = conn.from.id; // ID of the source neuron
        const toIndex = conn.to.id;     // ID of the target neuron
        
        // Find the corresponding layer for each neuron
        let fromLayer = -1;
        let toLayer = -1;

        for (let layer = 0; layer < layerCount; layer++) {
            const fromLayerNeuron = neuronPositions[layer].find(n => n.id === fromIndex);
            if (fromLayerNeuron) {
                fromLayer = layer;
            }
            const toLayerNeuron = neuronPositions[layer].find(n => n.id === toIndex);
            if (toLayerNeuron) {
                toLayer = layer;
            }
        }

        if (fromLayer !== -1 && toLayer !== -1 && fromLayer !== toLayer) {
            const start = neuronPositions[fromLayer].find(n => n.id === fromIndex);
            const end = neuronPositions[toLayer].find(n => n.id === toIndex);
            if (start && end) {
                ctx.beginPath();
                ctx.moveTo(start.x, start.y);
                ctx.lineTo(end.x, end.y);
                ctx.stroke();
            }
        }
    });

    // Draw neurons
    for (let layer = 0; layer < layerCount; layer++) {
        for (let neuron = 0; neuron < neuronPositions[layer].length; neuron++) {
            const {x, y} = neuronPositions[layer][neuron];
            ctx.beginPath();
            ctx.arc(x, y, 10, 0, 2 * Math.PI);
            ctx.fillStyle = layer === 0 ? 'blue' : layer === layerCount - 1 ? 'green' : 'white';
            ctx.fill();
            ctx.strokeStyle = 'black';
            ctx.stroke();
        }
    }
}

function calculateNeuronPositions(network) {
    if (!network || !network.nodes) {
        console.error('Invalid network structure:', network);
        return [];
    }

    const nodes = network.nodes;
    const inputNodes = nodes.filter(n => n.type === 'input');
    const outputNodes = nodes.filter(n => n.type === 'output');
    const hiddenNodes = nodes.filter(n => n.type === 'hidden');

    const layers = [
        inputNodes,
        hiddenNodes,
        outputNodes
    ];

    const layerCount = layers.length;
    const neuronPositions = [];

    const startX = CANVAS_WIDTH - 300;
    const startY = CANVAS_HEIGHT - 300;
    const width = 200;
    const height = 200;

    for (let i = 0; i < layerCount; i++) {
        const layerSize = layers[i].length;
        const positions = [];

        for (let j = 0; j < layerSize; j++) {
            positions.push({
                id: layers[i][j].id, // Adicionar ID para mapeamento
                x: startX + (i / (layerCount - 1)) * width,
                y: startY + (j / (Math.max(layerSize - 1, 1))) * height
            });
        }

        neuronPositions.push(positions);
    }

    return neuronPositions;
}