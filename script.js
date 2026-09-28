// Початковий стан гри
const defaultState = {
    level: 1,
    exp: 0,
    gold: 0,
    statPoints: 0,
    stats: {
        str: 10, // Сила (Урон кліку)
        agi: 10, // Спритність (Крит)
        int: 10  // Інтелект (Урон тіней)
    },
    shadows: {
        infantry: 0,
        knight: 0,
        mage: 0
    },
    equipment: {
        weaponLevel: 0
    }
};

let game = JSON.parse(localStorage.getItem('soloLevelingSave')) || JSON.parse(JSON.stringify(defaultState));

// Налаштування магазину Тіней
const shadowsData = {
    infantry: { name: "Тіньовий Піхотинець", baseCost: 50, dps: 2 },
    knight: { name: "Тіньовий Лицар", baseCost: 500, dps: 15 },
    mage: { name: "Вищий Орк-Маг", baseCost: 5000, dps: 100 }
};

// Налаштування Екіпірування (Зброя дає множник урону)
const weaponData = [
    { name: "Зламаний Кинджал", cost: 100, multiplier: 1.5 },
    { name: "Ікло Касаки", cost: 1000, multiplier: 3.0 },
    { name: "Вбивця Лицарів", cost: 5000, multiplier: 8.0 },
    { name: "Гнів Короля Демонів", cost: 25000, multiplier: 20.0 }
];

// Ворог
let monster = {
    level: 1,
    maxHp: 50,
    hp: 50
};

// Обчислення характеристик
function getClickDamage() {
    let baseDmg = game.stats.str * 2;
    let weaponMult = game.equipment.weaponLevel > 0 ? weaponData[game.equipment.weaponLevel - 1].multiplier : 1;
    return Math.floor(baseDmg * weaponMult);
}

function getCritChance() {
    return Math.min(game.stats.agi * 0.5, 50); // Максимум 50%
}

function getShadowDPS() {
    let dps = 0;
    dps += game.shadows.infantry * shadowsData.infantry.dps;
    dps += game.shadows.knight * shadowsData.knight.dps;
    dps += game.shadows.mage * shadowsData.mage.dps;
    
    // Інтелект збільшує урон тіней (кожні 1 INT = +2%)
    let intMult = 1 + (game.stats.int - 10) * 0.02; 
    return Math.floor(dps * intMult);
}

// Функція атаки по кліку
function attackMonster(event) {
    let dmg = getClickDamage();
    let isCrit = Math.random() * 100 < getCritChance();
    
    if (isCrit) dmg *= 2; // Крит завдає х2 шкоди

    dealDamage(dmg);
    showDamageText(event.clientX, event.clientY, dmg, isCrit);
    
    // Анімація монстра
    const sprite = document.getElementById('monster-sprite');
    sprite.style.backgroundColor = 'white';
    setTimeout(() => sprite.style.backgroundColor = '#ef4444', 50);
}

// Загальна функція отримання шкоди монстром
function dealDamage(amount) {
    monster.hp -= amount;
    if (monster.hp <= 0) {
        monsterDefeated();
    }
    updateUI();
}

function monsterDefeated() {
    // Нагорода
    let expGain = 20 * monster.level;
    let goldGain = 5 * monster.level;
    
    game.exp += expGain;
    game.gold += goldGain;
    
    checkLevelUp();
    
    // Наступний монстр
    monster.level += 1;
    monster.maxHp = Math.floor(50 * Math.pow(1.5, monster.level - 1));
    monster.hp = monster.maxHp;
    
    saveGame();
}

function checkLevelUp() {
    let maxExp = Math.floor(100 * Math.pow(1.3, game.level - 1));
    while (game.exp >= maxExp) {
        game.exp -= maxExp;
        game.level++;
        game.statPoints += 3; // +3 очки статів за рівень
        maxExp = Math.floor(100 * Math.pow(1.3, game.level - 1));
    }
}

function upgradeStat(stat) {
    if (game.statPoints > 0) {
        game.stats[stat]++;
        game.statPoints--;
        updateUI();
        saveGame();
    }
}

// Автоклік Тіней (Loop)
setInterval(() => {
    let dps = getShadowDPS();
    if (dps > 0) {
        dealDamage(Math.max(1, dps / 10)); // Викликається кожні 100мс
    }
}, 100);

// Купівля тіней
function buyShadow(type) {
    let cost = Math.floor(shadowsData[type].baseCost * Math.pow(1.15, game.shadows[type]));
    if (game.gold >= cost) {
        game.gold -= cost;
        game.shadows[type]++;
        renderShop();
        updateUI();
        saveGame();
    }
}

// Купівля зброї
function buyWeapon() {
    let nextWep = weaponData[game.equipment.weaponLevel];
    if (nextWep && game.gold >= nextWep.cost) {
        game.gold -= nextWep.cost;
        game.equipment.weaponLevel++;
        renderShop();
        updateUI();
        saveGame();
    }
}

// UI Логіка
function showDamageText(x, y, dmg, isCrit) {
    const container = document.getElementById('damage-numbers-container');
    const text = document.createElement('div');
    text.className = `damage-text ${isCrit ? 'crit-text' : ''}`;
    text.innerText = dmg;
    
    // Випадкове відхилення
    let offsetX = (Math.random() - 0.5) * 40;
    text.style.left = `calc(50% + ${offsetX}px)`;
    text.style.top = '40%';
    
    container.appendChild(text);
    setTimeout(() => text.remove(), 800);
}

function switchTab(tabId) {
    document.getElementById('tab-shadows').style.display = tabId === 'shadows' ? 'block' : 'none';
    document.getElementById('tab-equipment').style.display = tabId === 'equipment' ? 'block' : 'none';
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
}

function renderShop() {
    // Рендер Тіней
    let shadowsHTML = '';
    for (const [key, data] of Object.entries(shadowsData)) {
        let cost = Math.floor(data.baseCost * Math.pow(1.15, game.shadows[key]));
        shadowsHTML += `
            <div class="shop-item">
                <h4>${data.name} (К-ть: ${game.shadows[key]})</h4>
                <p>DPS: ${data.dps}</p>
                <button class="buy-btn" ${game.gold < cost ? 'disabled' : ''} onclick="buyShadow('${key}')">Призвати: ${cost} G</button>
            </div>
        `;
    }
    document.getElementById('shadows-list').innerHTML = shadowsHTML;

    // Рендер Зброї
    let eqHTML = '';
    let nextWep = weaponData[game.equipment.weaponLevel];
    if (nextWep) {
        eqHTML = `
            <div class="shop-item">
                <h4>${nextWep.name}</h4>
                <p>Множник Урону: x${nextWep.multiplier}</p>
                <button class="buy-btn" ${game.gold < nextWep.cost ? 'disabled' : ''} onclick="buyWeapon()">Купити: ${nextWep.cost} G</button>
            </div>
        `;
    } else {
        eqHTML = `<p style="color: var(--accent-glow)">Ви купили всю зброю!</p>`;
    }
    document.getElementById('equipment-list').innerHTML = eqHTML;
}

function updateUI() {
    document.getElementById('level-display').innerText = game.level;
    document.getElementById('gold-display').innerText = Math.floor(game.gold);
    document.getElementById('click-dmg-display').innerText = getClickDamage();
    document.getElementById('dps-display').innerText = getShadowDPS();
    
    document.getElementById('stat-str').innerText = game.stats.str;
    document.getElementById('stat-agi').innerText = game.stats.agi;
    document.getElementById('stat-int').innerText = game.stats.int;
    document.getElementById('stat-points').innerText = game.statPoints;
    
    // Оновлення смужок
    let maxExp = Math.floor(100 * Math.pow(1.3, game.level - 1));
    let expPercent = (game.exp / maxExp) * 100;
    document.getElementById('exp-bar').style.width = `${expPercent}%`;
    document.getElementById('exp-text').innerText = `${Math.floor(game.exp)} / ${maxExp} XP`;
    
    let hpPercent = (monster.hp / monster.maxHp) * 100;
    document.getElementById('monster-hp-bar').style.width = `${hpPercent}%`;
    document.getElementById('monster-hp-text').innerText = `${Math.floor(Math.max(0, monster.hp))} / ${monster.maxHp}`;
    document.getElementById('monster-name').innerText = `Монстр Рівень ${monster.level}`;

    // Ховаємо кнопки плюсів, якщо немає очок
    document.querySelectorAll('.upgrade-btn').forEach(btn => {
        btn.style.display = game.statPoints > 0 ? 'inline-block' : 'none';
    });

    renderShop(); // Оновлюємо кнопки (доступні/недоступні)
}

function saveGame() {
    localStorage.setItem('soloLevelingSave', JSON.stringify(game));
}

function resetGame() {
    if(confirm('Ви впевнені, що хочете видалити збереження і почати заново?')) {
        localStorage.removeItem('soloLevelingSave');
        location.reload();
    }
}

// Ініціалізація
monster.maxHp = Math.floor(50 * Math.pow(1.5, monster.level - 1));
monster.hp = monster.maxHp;
updateUI();
// Зберігаємо кожні 5 секунд про всяк випадок
setInterval(saveGame, 5000);
