let tg = window.Telegram ? window.Telegram.WebApp : null;
try { if (tg) tg.expand(); } catch(e) {}

// --- ВАША КОНФІГУРАЦІЯ FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyCyoarH4aW-qmn8BSr_uDi-MMbuqZhje18",
    authDomain: "sololeveling-tg.firebaseapp.com",
    databaseURL: "https://sololeveling-tg-default-rtdb.firebaseio.com", 
    projectId: "sololeveling-tg",
    storageBucket: "sololeveling-tg.firebasestorage.app",
    messagingSenderId: "311638883271",
    appId: "1:311638883271:web:2e630f5042c566c5c5b7e2"
};

// Ініціалізація Бази Даних
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let userId = "guest_user";
let playerName = "Мисливець";
let avatarUrl = "https://placehold.co/100/003366/white?text=M";

// Підтягування профілю з Telegram
if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
    userId = tg.initDataUnsafe.user.id.toString();
    playerName = tg.initDataUnsafe.user.first_name || tg.initDataUnsafe.user.username || "Мисливець";
    if (tg.initDataUnsafe.user.photo_url) avatarUrl = tg.initDataUnsafe.user.photo_url;
}

const defaultState = {
    level: 1, exp: 0, gold: 0, statPoints: 0,
    stats: { str: 10, agi: 10, int: 10 },
    shadows: { infantry: 0, knight: 0, mage: 0 },
    equipment: { weaponLevel: 0 },
    monsterLevel: 1, monsterHp: 50
};

let game = null;

const monstersData = [
    { name: "Слабкий Гоблін", img: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Goblin.png" },
    { name: "Синій Вовк", img: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Wolf.png" },
    { name: "Вищий Орк", img: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Ogre.png" },
    { name: "Король Демонів", img: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Skull.png" }
];

const shadowsData = { 
    infantry: { name: "Тінь-Піхотинець", baseCost: 50, dps: 2 }, 
    knight: { name: "Тінь-Лицар", baseCost: 500, dps: 15 }, 
    mage: { name: "Ігріс", baseCost: 5000, dps: 100 } 
};
const weaponData = [ 
    { name: "Зламаний Кинджал", cost: 100, multiplier: 1.5 }, 
    { name: "Ікло Касаки", cost: 1000, multiplier: 3.0 }, 
    { name: "Вбивця Лицарів", cost: 5000, multiplier: 8.0 }, 
    { name: "Гнів Демона", cost: 25000, multiplier: 20.0 } 
];

let monster = { level: 1, maxHp: 50, hp: 50 };

function getPlayerRankInfo(level) {
    if (level < 10) return { name: "Ранг E", class: "rank-e" };
    if (level < 25) return { name: "Ранг D", class: "rank-d" };
    if (level < 50) return { name: "Ранг C", class: "rank-c" };
    if (level < 75) return { name: "Ранг B", class: "rank-b" };
    if (level < 100) return { name: "Ранг A", class: "rank-a" };
    return { name: "Ранг S", class: "rank-s" };
}

// Завантаження гри (Firebase -> Локально)
function initGame() {
    document.getElementById('player-name').innerText = playerName;
    document.getElementById('player-avatar').src = avatarUrl;

    db.ref('users/' + userId).once('value').then((snapshot) => {
        if (snapshot.exists()) {
            game = snapshot.val();
        } else {
            game = JSON.parse(JSON.stringify(defaultState));
        }
        
        if (!game.monsterLevel) game.monsterLevel = game.level;
        if (!game.monsterHp) game.monsterHp = Math.floor(50 * Math.pow(1.5, game.monsterLevel - 1));

        startGameLoop();
    }).catch((error) => {
        console.error("Помилка БД, завантажуємо локально", error);
        game = JSON.parse(localStorage.getItem('soloSave')) || JSON.parse(JSON.stringify(defaultState));
        
        if (!game.monsterLevel) game.monsterLevel = game.level;
        if (!game.monsterHp) game.monsterHp = Math.floor(50 * Math.pow(1.5, game.monsterLevel - 1));
        
        startGameLoop();
    });
}

function startGameLoop() {
    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('game-container').style.display = 'flex';
    
    monster.level = game.monsterLevel;
    monster.hp = game.monsterHp;
    
    setMonsterData();
    updateUI();

    // Автоклік тіней
    setInterval(() => {
        let dps = getShadowDPS();
        if (dps > 0) dealDamage(Math.max(1, dps / 10));
    }, 100);

    // Збереження кожні 5 секунд
    setInterval(saveGame, 5000);
}

// Розширене збереження в базу даних (з ніком, рангом, статами та станом армії)
function saveGame() {
    if (!game) return;
    game.monsterLevel = monster.level;
    game.monsterHp = monster.hp;
    
    // Локальний бекап
    localStorage.setItem('soloSave', JSON.stringify(game));
    
    // Отримуємо поточний ранг для бази даних
    let rankInfo = getPlayerRankInfo(game.level);

    // Запис у вашу БД Firebase з повною інформацією про гравця
    db.ref('users/' + userId).set({
        // Базові дані профілю
        username: playerName,
        avatar: avatarUrl,
        rank: rankInfo.name,
        
        // Ігровий прогрес
        level: game.level,
        exp: game.exp,
        gold: game.gold,
        
        // Характеристики та спорядження
        stats: game.stats,
        equipmentLevel: game.equipment.weaponLevel,
        shadowsCount: game.shadows.infantry + game.shadows.knight + game.shadows.mage,
        
        // Стан поточного монстра
        monsterLevel: game.monsterLevel,
        monsterHp: game.monsterHp,
        
        // Час останньої активності (зручно для майбутніх таблиць лідерів)
        lastActive: firebase.database.ServerValue.TIMESTAMP
    }).catch(e => console.log("Помилка збереження в БД"));
}
function setMonsterData() {
    monster.maxHp = Math.floor(50 * Math.pow(1.5, monster.level - 1));
    if (monster.hp <= 0) monster.hp = monster.maxHp;
    let mIndex = (monster.level - 1) % monstersData.length;
    document.getElementById('monster-name').innerText = `[Lv.${monster.level}] ${monstersData[mIndex].name}`;
    document.getElementById('monster-sprite').src = monstersData[mIndex].img;
}

function getClickDamage() { return Math.floor((game.stats.str * 2) * (game.equipment.weaponLevel > 0 ? weaponData[game.equipment.weaponLevel - 1].multiplier : 1)); }
function getCritChance() { return Math.min(game.stats.agi * 0.5, 50); }
function getShadowDPS() { return Math.floor((game.shadows.infantry * shadowsData.infantry.dps + game.shadows.knight * shadowsData.knight.dps + game.shadows.mage * shadowsData.mage.dps) * (1 + (game.stats.int - 10) * 0.02)); }

function attackMonster(event) {
    if (tg && tg.HapticFeedback) { try { tg.HapticFeedback.impactOccurred('light'); } catch(e) {} }
    let dmg = getClickDamage();
    let isCrit = Math.random() * 100 < getCritChance();
    if (isCrit) { dmg *= 2; if (tg && tg.HapticFeedback) { try { tg.HapticFeedback.impactOccurred('heavy'); } catch(e) {} } }

    dealDamage(dmg);
    
    let rect = document.getElementById('monster-container').getBoundingClientRect();
    let x = event.clientX ? event.clientX - rect.left : rect.width / 2;
    let y = event.clientY ? event.clientY - rect.top : rect.height / 2;
    
    showDamageText(x, y, dmg, isCrit);
    createSlashEffect(x, y);
    
    const sprite = document.getElementById('monster-sprite');
    sprite.classList.remove('hit-shake'); void sprite.offsetWidth; sprite.classList.add('hit-shake');
}

function dealDamage(amount) {
    monster.hp -= amount;
    if (monster.hp <= 0) monsterDefeated();
    else updateMonsterHPUI();
}

function updateMonsterHPUI() {
    let hpPercent = Math.max(0, (monster.hp / monster.maxHp) * 100);
    document.getElementById('monster-hp-bar').style.width = `${hpPercent}%`;
    document.getElementById('monster-hp-text').innerText = `${Math.floor(Math.max(0, monster.hp))} / ${monster.maxHp}`;
}

function monsterDefeated() {
    if (tg && tg.HapticFeedback) { try { tg.HapticFeedback.notificationOccurred('success'); } catch(e) {} }
    game.exp += 20 * monster.level; game.gold += 5 * monster.level;
    checkLevelUp();
    monster.level += 1; monster.hp = 0; 
    setMonsterData(); saveGame(); updateUI();
}

function checkLevelUp() {
    let maxExp = Math.floor(100 * Math.pow(1.3, game.level - 1));
    while (game.exp >= maxExp) {
        game.exp -= maxExp; game.level++; game.statPoints += 3;
        maxExp = Math.floor(100 * Math.pow(1.3, game.level - 1));
    }
}

function upgradeStat(stat) { if (game.statPoints > 0) { game.stats[stat]++; game.statPoints--; updateUI(); saveGame(); } }
function buyShadow(type) { let cost = Math.floor(shadowsData[type].baseCost * Math.pow(1.15, game.shadows[type])); if (game.gold >= cost) { game.gold -= cost; game.shadows[type]++; updateUI(); saveGame(); } }
function buyWeapon() { let nextWep = weaponData[game.equipment.weaponLevel]; if (nextWep && game.gold >= nextWep.cost) { game.gold -= nextWep.cost; game.equipment.weaponLevel++; updateUI(); saveGame(); } }

function showDamageText(x, y, dmg, isCrit) {
    const text = document.createElement('div'); text.className = `damage-text ${isCrit ? 'crit-text' : ''}`; text.innerText = dmg;
    text.style.left = `${x + (Math.random() - 0.5) * 60}px`; text.style.top = `${y - 20}px`;
    document.getElementById('monster-container').appendChild(text); setTimeout(() => text.remove(), 600);
}

function createSlashEffect(x, y) {
    const slash = document.createElement('div'); slash.className = 'slash-effect';
    slash.style.left = `${x - 60}px`; slash.style.top = `${y}px`; slash.style.transform = `rotate(${Math.random() * 360}deg)`;
    document.getElementById('monster-container').appendChild(slash); setTimeout(() => slash.remove(), 150);
}

function switchTab(tabId) {
    document.getElementById('tab-shadows').style.display = tabId === 'shadows' ? 'block' : 'none';
    document.getElementById('tab-equipment').style.display = tabId === 'equipment' ? 'block' : 'none';
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active')); event.target.classList.add('active');
}

function renderShop() {
    let shadowsHTML = '';
    for (const [key, data] of Object.entries(shadowsData)) {
        let cost = Math.floor(data.baseCost * Math.pow(1.15, game.shadows[key]));
        shadowsHTML += `<div class="shop-item"><div class="shop-item-info"><h4>${data.name} [Lv.${game.shadows[key]}]</h4><p>DPS: ${data.dps}</p></div><button class="buy-btn" ${game.gold < cost ? 'disabled' : ''} onclick="buyShadow('${key}')">${cost} G</button></div>`;
    }
    document.getElementById('shadows-list').innerHTML = shadowsHTML;

    let eqHTML = ''; let nextWep = weaponData[game.equipment.weaponLevel];
    if (nextWep) { eqHTML = `<div class="shop-item"><div class="shop-item-info"><h4>${nextWep.name}</h4><p>Урон: x${nextWep.multiplier}</p></div><button class="buy-btn" ${game.gold < nextWep.cost ? 'disabled' : ''} onclick="buyWeapon()">${nextWep.cost} G</button></div>`; }
    else { eqHTML = `<p style="text-align:center; color: var(--sys-blue); margin-top:10px;">Всі предмети куплено!</p>`; }
    document.getElementById('equipment-list').innerHTML = eqHTML;
}

function updateUI() {
    let rankInfo = getPlayerRankInfo(game.level);
    let rankEl = document.getElementById('player-rank');
    rankEl.innerText = rankInfo.name; rankEl.className = rankInfo.class;

    document.getElementById('level-display').innerText = game.level;
    document.getElementById('gold-display').innerText = Math.floor(game.gold);
    document.getElementById('click-dmg-display').innerText = getClickDamage();
    document.getElementById('dps-display').innerText = getShadowDPS();
    document.getElementById('stat-str').innerText = game.stats.str;
    document.getElementById('stat-agi').innerText = game.stats.agi;
    document.getElementById('stat-int').innerText = game.stats.int;
    document.getElementById('stat-points').innerText = game.statPoints;
    
    let maxExp = Math.floor(100 * Math.pow(1.3, game.level - 1));
    document.getElementById('exp-bar').style.width = `${(game.exp / maxExp) * 100}%`;
    document.getElementById('exp-text').innerText = `${Math.floor(game.exp)} / ${maxExp} XP`;

    document.querySelectorAll('.upgrade-btn').forEach(btn => { btn.style.display = game.statPoints > 0 ? 'inline-block' : 'none'; });
    updateMonsterHPUI(); renderShop();
}

// Запуск!
initGame();
