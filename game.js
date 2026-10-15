const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const screens = {
  start: document.getElementById('startScreen'),
  tutorial: document.getElementById('tutorialScreen'),
  lobby: document.getElementById('lobbyScreen'),
  gameOver: document.getElementById('gameOverScreen')
};

const hud = document.getElementById('hud');
// updated element ids (index.html uses playerHealthWrap / playerLabel now)
const healthWrap = document.getElementById('playerHealthWrap') || document.getElementById('healthWrap');
const playerLabel = document.getElementById('playerLabel') || document.getElementById('kernelLabel');
const teammate1HealthWrap = document.getElementById('teammate1HealthWrap');
const teammate2HealthWrap = document.getElementById('teammate2HealthWrap');
const teammate1Label = document.getElementById('teammate1Label');
const teammate2Label = document.getElementById('teammate2Label');
const bossInfo = document.getElementById('bossInfo');
const statusText = document.getElementById('statusText');
const gameoverTitle = document.getElementById('gameoverTitle');
const gameoverText = document.getElementById('gameoverText');

const startBtn = document.getElementById('startBtn');
const tutorialBtn = document.getElementById('tutorialBtn');
const soloBtn = document.getElementById('soloBtn');
const friendsBtn = document.getElementById('friendsBtn');
const retryBtn = document.getElementById('retryBtn');
const startGameBtn = document.getElementById('startGameBtn');

const kernelButtons = [...document.querySelectorAll('.kernel-card-btn')];

const keys = {};
let selectedKernel = 'shield';
let roundIndex = 0;
let gameState = 'menu';
let lastTime = 0;
let statusTimer = 0;

const bossDefinitions = [
  {
    name: 'Butter',
    hp: 120,
    color: '#f7d75d',
    rate: 1.2,
    pattern: 'butter',
    message: 'Butter fires diamond pellets and spinning spirals.'
  },
  {
    name: 'Salt',
    hp: 150,
    color: '#d7e6f2',
    rate: 1.15,
    pattern: 'salt',
    message: 'The shaker rains salt crystals into marked zones.'
  },
  {
    name: 'Fire',
    hp: 180,
    color: '#ff835d',
    rate: 1.0,
    pattern: 'fire',
    message: 'Flame jets and embers cut across the pan.'
  },
  {
    name: 'Magnetron',
    hp: 220,
    color: '#81d8ff',
    rate: 0.75,
    pattern: 'magnetron',
    message: 'The microwave ends with rings, lasers, and a shockwave.'
  }
];

const player = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  radius: 16,
  speed: 240,
  hp: 3,
  maxHp: 3,
  abilityCooldown: 0,
  shieldTimer: 0,
  trail: [],
  invuln: 0,
  aimAngle: 0,
  kernel: 'shield'
};

// simple teammate placeholders (no full AI yet) so HUD shows correctly
const teammate1 = { name: 'Ally 1', hp: 3, maxHp: 3, kernel: 'heal', down: false };
const teammate2 = { name: 'Ally 2', hp: 3, maxHp: 3, kernel: 'catch', down: false };

let bullets = [];
let particles = [];
let warnings = [];
let boss = null;
let battleActive = false;
let titleFlash = 0;

function resetPlayer() {
  player.x = canvas.width / 2;
  player.y = canvas.height / 2;
  player.hp = 3;
  player.maxHp = 3;
  player.abilityCooldown = 0;
  player.shieldTimer = 0;
  player.invuln = 0;
  player.kernel = selectedKernel;

  teammate1.hp = teammate1.maxHp;
  teammate2.hp = teammate2.maxHp;
  teammate1.down = false;
  teammate2.down = false;
}

function setStatus(message, duration = 2.2) {
  statusText.textContent = message;
  statusTimer = duration;
}

function showScreen(name) {
  Object.entries(screens).forEach(([key, element]) => {
    element.classList.toggle('hidden', key !== name);
    element.classList.toggle('active', key === name);
  });
}

function setKernelMode(kernel) {
  selectedKernel = kernel;
  player.kernel = kernel;
  kernelButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.kernel === kernel);
  });

  const labels = {
    shield: 'Shield Kernel',
    heal: 'Heal Kernel',
    catch: 'Catch & Throw'
  };

  if (playerLabel) playerLabel.textContent = `You — ${labels[kernel]}`;
}

// render hearts with half-heart support
function renderHealth(container, hp, maxHp) {
  if (!container) return;
  container.innerHTML = '';
  for (let i = 0; i < maxHp; i += 1) {
    const heart = document.createElement('div');
    if (hp >= i + 1) {
      heart.className = 'heart';
    } else if (hp >= i + 0.5) {
      heart.className = 'heart half';
    } else {
      heart.className = 'heart empty';
    }
    container.appendChild(heart);
  }
}

function updateHealthHud() {
  renderHealth(healthWrap, player.hp, player.maxHp);
  renderHealth(teammate1HealthWrap, teammate1.hp, teammate1.maxHp);
  renderHealth(teammate2HealthWrap, teammate2.hp, teammate2.maxHp);
}

function startGame() {
  battleActive = true;
  roundIndex = 0;
  bullets = [];
  particles = [];
  warnings = [];
  titleFlash = 0;
  resetPlayer();
  hud.classList.remove('hidden');
  updateHealthHud();
  spawnBoss();
  documentsReady();
}

function nextRound() {
  roundIndex += 1;

  if (roundIndex >= bossDefinitions.length) {
    winGame();
    return;
  }

  setStatus(`Round clear! ${bossDefinitions[roundIndex].name} incoming!`, 2.5);
  // give a second to reset and then spawn
  setTimeout(() => {
    if (battleActive) {
      spawnBoss();
    }
  }, 1200);
}

function spawnBoss() {
  const definition = bossDefinitions[roundIndex];
  boss = {
    name: definition.name,
    maxHp: definition.hp,
    hp: definition.hp,
    color: definition.color,
    rate: definition.rate,
    pattern: definition.pattern,
    attackTimer: 1,
    phaseTimer: 0,
    selfDestruct: 0,
    x: canvas.width / 2,
    y: 110,
    radius: 48
  };

  bossInfo.textContent = `${boss.name} | HP ${boss.hp}/${boss.maxHp}`;
  setStatus(definition.message, 3);
}

function triggerAbility() {
  if (!battleActive || player.abilityCooldown > 0) return;

  const kernel = selectedKernel;

  if (kernel === 'shield') {
    player.shieldTimer = 4.2;
    player.abilityCooldown = 8;
    setStatus('Shield Kernel: barrier online!', 1.2);
    for (let i = 0; i < 18; i += 1) {
      particles.push({
        x: player.x,
        y: player.y,
        radius: 3 + Math.random() * 2,
        dx: (Math.random() - 0.5) * 90,
        dy: (Math.random() - 0.5) * 90,
        life: 0.7,
        color: '#7fe3ff'
      });
    }
  } else if (kernel === 'heal') {
    // heal now reliably consumes nearby projectiles and restores 0.5 HP per projectile
    player.abilityCooldown = 7;
    let recovered = 0;
    for (let i = bullets.length - 1; i >= 0; i -= 1) {
      const bullet = bullets[i];
      const dist = Math.hypot(bullet.x - player.x, bullet.y - player.y);
      if (dist < 140 && !bullet.isThrown) {
        bullets.splice(i, 1);
        recovered += 1;
        player.hp = Math.min(player.maxHp, +(player.hp + 0.5).toFixed(2));
        addBurst(player.x, player.y, '#f0e68c', 6, 90);
      }
    }
    if (recovered > 0) {
      updateHealthHud();
    }
    setStatus(recovered > 0 ? `Heal Kernel: restored ${recovered * 0.5} HP` : 'Heal Kernel: no nearby projectiles', 1.5);
  } else if (kernel === 'catch') {
    // catch nearby projectiles and throw them directly at the boss with a clear velocity
    player.abilityCooldown = 6;
    let thrown = 0;
    for (let i = bullets.length - 1; i >= 0; i -= 1) {
      const bullet = bullets[i];
      const dist = Math.hypot(bullet.x - player.x, bullet.y - player.y);
      if (dist < 150 && !bullet.isThrown) {
        // compute direction towards boss (or center)
        const targetX = boss ? boss.x : canvas.width / 2;
        const targetY = boss ? boss.y : 120;
        const vx = targetX - player.x;
        const vy = targetY - player.y;
        const vmag = Math.hypot(vx, vy) || 1;
        const speed = 420; // thrown speed
        bullet.dx = (vx / vmag) * speed;
        bullet.dy = (vy / vmag) * speed;
        bullet.x = player.x + (vx / vmag) * (player.radius + 6);
        bullet.y = player.y + (vy / vmag) * (player.radius + 6);
        bullet.color = '#f4d7a2';
        bullet.isThrown = true;
        bullet.fromBoss = false;
        bullet.damage = 26;
        thrown += 1;
        addBurst(bullet.x, bullet.y, '#f4d7a2', 6, 140);
      }
    }
    setStatus(thrown > 0 ? `Catch & Throw: ${thrown} launched` : 'Catch & Throw: no targets nearby.', 1.4);
  }
}

function addBurst(x, y, color, count = 12, speed = 180) {
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    particles.push({
      x,
      y,
      radius: 2 + Math.random() * 3,
      dx: Math.cos(angle) * speed * (0.6 + Math.random()),
      dy: Math.sin(angle) * speed * (0.6 + Math.random()),
      life: 0.7 + Math.random() * 0.5,
      color
    });
  }
}

function createWarning(x, y, radius, life = 1.2) {
  warnings.push({ x, y, radius, life, maxLife: life, color: '#fbe5a7' });
}

function shootBullet(x, y, angle, speed, radius = 6, color = '#fff', damage = 1, drift = 0) {
  bullets.push({
    x,
    y,
    radius,
    dx: Math.cos(angle) * speed,
    dy: Math.sin(angle) * speed,
    speed,
    damage,
    color,
    drift,
    life: 5,
    isThrown: false,
    fromBoss: true
  });
}

function shootPattern(pattern) {
  if (!boss) return;

  if (pattern === 'butter') {
    const count = 8;
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count + performance.now() * 0.0003;
      shootBullet(boss.x, boss.y, angle, 180, 6, '#f7d75d', 1, 0.15);
    }
    for (let i = 0; i < 12; i += 1) {
      const angle = i * (Math.PI / 6) + performance.now() * 0.001;
      shootBullet(boss.x, boss.y, angle, 200, 5, '#ffe077', 1, 0.2);
    }
  }

  if (pattern === 'salt') {
    const targetX = Math.random() * (canvas.width - 80) + 40;
    const targetY = Math.random() * (canvas.height - 100) + 80;
    createWarning(targetX, targetY, 48, 1.1);
    setTimeout(() => {
      for (let i = 0; i < 16; i += 1) {
        const angle = Math.atan2(player.y - targetY, player.x - targetX);
        shootBullet(targetX, targetY, angle + (Math.random() - 0.5) * 0.8, 210, 6, '#dfe9fb', 1);
      }
    }, 850);
  }

  if (pattern === 'fire') {
    const side = Math.random() < 0.5 ? -1 : 1;
    const x = side < 0 ? 24 : canvas.width - 24;
    const y = 140 + Math.random() * 260;
    for (let i = 0; i < 9; i += 1) {
      const angle = Math.atan2(player.y - y, player.x - x);
      shootBullet(x, y, angle + (Math.random() - 0.5) * 0.4, 240, 7, '#ff835d', 1);
    }
  }

  if (pattern === 'magnetron') {
    const ringCount = 16;
    const innerStep = (Math.PI * 2) / ringCount;
    for (let i = 0; i < ringCount; i += 1) {
      const angle = innerStep * i + performance.now() * 0.0007;
      shootBullet(boss.x, boss.y, angle, 210, 6, '#8fe6ff', 1, 0.0);
    }

    for (let i = 0; i < 14; i += 1) {
      const angle = (Math.PI * 2 * i) / 14;
      shootBullet(boss.x, boss.y, angle, 195, 5, '#a2f2ff', 1, 0.1);
    }

    if (Math.random() < 0.55) {
      for (let i = 0; i < 7; i += 1) {
        const angle = Math.PI / 7 * i;
        shootBullet(boss.x, boss.y, angle, 255, 7, '#d4f8ff', 1, 0.12);
      }
    }
  }
}

function updateBoss(dt) {
  if (!boss) return;

  boss.attackTimer -= dt;
  boss.phaseTimer += dt;

  if (boss.attackTimer <= 0) {
    shootPattern(boss.pattern);
    boss.attackTimer = boss.rate;
  }

  if (boss.name === 'Magnetron' && boss.hp <= boss.maxHp * 0.4) {
    boss.selfDestruct += dt;
    if (boss.selfDestruct > 1.5) {
      addBurst(boss.x, boss.y, '#aae7ff', 30, 160);
      for (let i = 0; i < 18; i += 1) {
        const angle = (Math.PI * 2 * i) / 18;
        shootBullet(boss.x, boss.y, angle, 260, 8, '#b5edff', 1);
      }
      boss.selfDestruct = 0;
    }
  }
}

function updatePlayer(dt) {
  const moveX = (keys.ArrowRight || keys.d ? 1 : 0) - (keys.ArrowLeft || keys.a ? 1 : 0);
  const moveY = (keys.ArrowDown || keys.s ? 1 : 0) - (keys.ArrowUp || keys.w ? 1 : 0);

  const mag = Math.hypot(moveX, moveY) || 1;
  player.x += (moveX / mag) * player.speed * dt;
  player.y += (moveY / mag) * player.speed * dt;

  player.x = Math.max(player.radius, Math.min(canvas.width - player.radius, player.x));
  player.y = Math.max(player.radius, Math.min(canvas.height - player.radius, player.y));

  player.invuln = Math.max(0, player.invuln - dt);
  player.abilityCooldown = Math.max(0, player.abilityCooldown - dt);
  player.shieldTimer = Math.max(0, player.shieldTimer - dt);

  player.trail.push({ x: player.x, y: player.y, life: 0.35 });
  if (player.trail.length > 8) player.trail.shift();
  player.trail.forEach((dot) => {
    dot.life -= dt;
  });
  player.trail = player.trail.filter((dot) => dot.life > 0);
}

function applyDamage(amount) {
  if (player.invuln > 0) return;
  player.hp -= amount;
  player.invuln = 0.8;
  updateHealthHud();

  if (player.hp <= 0) {
    endGame(false);
  }
}

function endGame(won) {
  battleActive = false;
  hud.classList.add('hidden');
  showScreen('gameOver');

  if (won) {
    gameoverTitle.textContent = 'You survived the pan!';
    gameoverText.textContent = 'The kernels stood strong and escaped the popper.';
  } else {
    gameoverTitle.textContent = 'You were popped!';
    gameoverText.textContent = `${boss ? boss.name : 'The pan'} won this round.`;
  }
}

function winGame() {
  battleActive = false;
  setStatus('Victory! You survived all four rounds!', 9999);
  endGame(true);
}

function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const bullet = bullets[i];
    bullet.x += bullet.dx * dt;
    bullet.y += bullet.dy * dt;
    bullet.life -= dt;

    if ((bullet.isThrown && bullet.x > canvas.width + 50) || bullet.x < -50 || bullet.y > canvas.height + 50 || bullet.y < -50) {
      bullets.splice(i, 1);
      continue;
    }

    if (!bullet.isThrown) {
      const dist = Math.hypot(bullet.x - player.x, bullet.y - player.y);
      const shieldRadius = player.shieldTimer > 0 ? 55 : 0;

      if (dist < player.radius + bullet.radius + shieldRadius) {
        if (player.shieldTimer > 0) {
          bullet.dx *= -1.1;
          bullet.dy *= -1.1;
          bullet.color = '#7fe3ff';
          bullet.isThrown = true;
          bullet.fromBoss = false;
          bullet.damage = 18;
          addBurst(bullet.x, bullet.y, '#7fe3ff', 8, 90);
        } else {
          bullets.splice(i, 1);
          applyDamage(bullet.damage || 1);
          addBurst(player.x, player.y, '#ff8d7c', 10, 120);
          continue;
        }
      }
    }

    if (bullet.isThrown && boss) {
      const bossDist = Math.hypot(bullet.x - boss.x, bullet.y - boss.y);
      if (bossDist < boss.radius + bullet.radius + 5) {
        bullets.splice(i, 1);
        boss.hp -= bullet.damage || 20;
        addBurst(boss.x, boss.y, '#f8d05d', 14, 110);

        if (boss.hp <= 0) {
          addBurst(boss.x, boss.y, '#ffffff', 35, 200);
          boss = null;
          setStatus(`${bossDefinitions[roundIndex].name} defeated!`, 1.5);
          setTimeout(() => {
            if (battleActive) {
              nextRound();
            }
          }, 1200);
        } else {
          bossInfo.textContent = `${boss.name} | HP ${boss.hp}/${boss.maxHp}`;
        }
      }
    }

    if (bullet.life <= 0 || bullet.x < -10 || bullet.x > canvas.width + 10 || bullet.y < -10 || bullet.y > canvas.height + 10) {
      bullets.splice(i, 1);
    }
  }
}

function updateWarnings(dt) {
  for (let i = warnings.length - 1; i >= 0; i -= 1) {
    warnings[i].life -= dt;
    if (warnings[i].life <= 0) {
      warnings.splice(i, 1);
    }
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.x += p.dx * dt;
    p.y += p.dy * dt;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawPan() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const panGradient = ctx.createRadialGradient(
    canvas.width / 2,
    canvas.height / 2,
    70,
    canvas.width / 2,
    canvas.height / 2,
    500
  );
  panGradient.addColorStop(0, 'rgba(255, 244, 176, 0.34)');
  panGradient.addColorStop(0.7, 'rgba(148, 112, 68, 0.6)');
  panGradient.addColorStop(1, 'rgba(21, 11, 6, 0.95)');

  ctx.fillStyle = panGradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 3;
  ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  for (let i = 0; i < 10; i += 1) {
    ctx.fillRect(80 + i * 90, 80, 50, 5);
  }
}

function drawPlayer() {
  player.trail.forEach((dot, index) => {
    const ratio = index / player.trail.length;
    ctx.beginPath();
    ctx.fillStyle = `rgba(255, 246, 180, ${0.15 + ratio * 0.35})`;
    ctx.arc(dot.x, dot.y, player.radius * (0.35 + ratio * 0.6), 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.beginPath();
  ctx.fillStyle = player.shieldTimer > 0 ? '#7fe3ff' : '#f7d45c';
  ctx.arc(player.x, player.y, player.radius + (player.shieldTimer > 0 ? 12 : 0), 0, Math.PI * 2);
  ctx.fill();

  if (player.shieldTimer > 0) {
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(127, 227, 255, 0.8)';
    ctx.lineWidth = 3;
    ctx.arc(player.x, player.y, player.radius + 18, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.fillStyle = '#3d2b1b';
  ctx.arc(player.x, player.y, player.radius - 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.fillStyle = '#fff7df';
  ctx.arc(player.x - 4, player.y - 3, 3, 0, Math.PI * 2);
  ctx.arc(player.x + 4, player.y - 3, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.strokeStyle = '#3a1b1d';
  ctx.lineWidth = 2;
  ctx.arc(player.x, player.y + 5, 5, 0, Math.PI);
  ctx.stroke();
}

function drawBoss() {
  if (!boss) return;
  ctx.beginPath();
  ctx.fillStyle = boss.color;
  ctx.arc(boss.x, boss.y, boss.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.arc(boss.x - 14, boss.y - 8, 8, 0, Math.PI * 2);
  ctx.arc(boss.x + 14, boss.y - 8, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.strokeStyle = '#3b1b22';
  ctx.lineWidth = 2;
  ctx.arc(boss.x, boss.y + 12, 10, 0, Math.PI);
  ctx.stroke();

  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(boss.x - 60, boss.y - 70, 120, 10);
  ctx.fillStyle = '#f0f7ff';
  ctx.fillRect(boss.x - 60, boss.y - 70, 120 * (boss.hp / boss.maxHp), 10);
}

function drawBullets() {
  bullets.forEach((bullet) => {
    ctx.beginPath();
    ctx.fillStyle = bullet.color;
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawWarnings() {
  warnings.forEach((warning) => {
    const alpha = warning.life / warning.maxLife;
    ctx.beginPath();
    ctx.strokeStyle = `rgba(251, 229, 167, ${0.5 + alpha * 0.5})`;
    ctx.lineWidth = 2;
    ctx.arc(warning.x, warning.y, warning.radius * (1.2 - alpha * 0.5), 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.fillStyle = `rgba(251, 229, 167, ${0.15 + alpha * 0.25})`;
    ctx.arc(warning.x, warning.y, warning.radius * 0.2, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawParticles() {
  particles.forEach((p) => {
    ctx.beginPath();
    ctx.fillStyle = p.color;
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  });
}

function updateStatus(dt) {
  if (statusTimer > 0) {
    statusTimer -= dt;
    if (statusTimer <= 0) {
      statusText.textContent = '';
    }
  }
}

function tick(timestamp) {
  const dt = Math.min(0.032, (timestamp - lastTime) / 1000 || 0.016);
  lastTime = timestamp;

  if (gameState === 'playing') {
    updatePlayer(dt);
    updateBoss(dt);
    updateBullets(dt);
    updateWarnings(dt);
    updateParticles(dt);
    updateStatus(dt);
    bossInfo.textContent = boss ? `${boss.name} | HP ${boss.hp}/${boss.maxHp}` : 'Defeated';
    if (playerLabel) playerLabel.textContent = `You — ${selectedKernel}`;
  }

  drawPan();
  if (gameState === 'playing') {
    drawWarnings();
    drawBullets();
    drawBoss();
    drawParticles();
    drawPlayer();
  }

  requestAnimationFrame(tick);
}

function startSoloGame() {
  gameState = 'playing';
  showScreen('none');
  screens.start.classList.add('hidden');
  screens.tutorial.classList.add('hidden');
  screens.lobby.classList.add('hidden');
  screens.gameOver.classList.add('hidden');
  hud.classList.remove('hidden');
  setStatus('Round 1: Butter enters the pan!', 2.7);
  startGame();
}

function beginTutorial() {
  showScreen('lobby');
}

function documentsReady() {
  updateHealthHud();
  setKernelMode(selectedKernel);
}

startBtn.addEventListener('click', () => {
  showScreen('tutorial');
});

tutorialBtn.addEventListener('click', () => {
  showScreen('lobby');
});

soloBtn && soloBtn.addEventListener('click', () => {
  startSoloGame();
});

friendsBtn && friendsBtn.addEventListener('click', () => {
  setStatus('Squad mode ready: invite your friends to the pan.', 2.5);
  startSoloGame();
});

startGameBtn && startGameBtn.addEventListener('click', () => {
  // squad start uses same single-player loop for now
  startSoloGame();
});

retryBtn.addEventListener('click', () => {
  showScreen('lobby');
  gameState = 'menu';
  hud.classList.add('hidden');
  startGame();
});

kernelButtons.forEach((button) => {
  button.addEventListener('click', () => {
    setKernelMode(button.dataset.kernel);
  });
});

window.addEventListener('keydown', (event) => {
  const code = event.code;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) {
    event.preventDefault();
  }
  keys[code.replace('Key', '').toLowerCase()] = true;
  keys[code] = true;

  if (code === 'Space') {
    triggerAbility();
  }
});

window.addEventListener('keyup', (event) => {
  const code = event.code;
  keys[code.replace('Key', '').toLowerCase()] = false;
  keys[code] = false;
});

documentsReady();
requestAnimationFrame(tick);

showScreen('start');
