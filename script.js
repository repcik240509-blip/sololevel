// Ініціалізація Telegram
let tg = window.Telegram ? window.Telegram.WebApp : null;
try { if (tg) tg.expand(); } catch(e) {}

// Отримання даних користувача
let userId = "guest_user";
let playerName = "Мисливець";
let avatarUrl = "https://placehold.co/100/003366/white?text=M";

if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
    userId = tg.initDataUnsafe.user.id.toString();
    playerName = tg.initDataUnsafe.user.first_name || tg.initDataUnsafe.user.username || "Мисливець";
    if (tg.initDataUnsafe.user.photo_url) avatarUrl = tg.initDataUnsafe.user.photo_url;
}

// --------------------------------------------------
// КОНФІГУРАЦІЯ FIREBASE (Виправлена)
// --------------------------------------------------
const firebaseConfig = {
    apiKey: "AIzaSyCyoarH4aW-qmn8BSr_uDi-MMbuqZhje18",
    authDomain: "sololeveling-tg.firebaseapp.com",
    // ДОДАНО ОБОВ'ЯЗКОВИЙ РЯДОК ДЛЯ БАЗИ ДАНИХ:
    databaseURL: "https://sololeveling-tg-default-rtdb.firebaseio.com", 
    projectId: "sololeveling-tg",
    storageBucket: "sololeveling-tg.firebasestorage.app",
    messagingSenderId: "311638883271",
    appId: "1:311638883271:web:2e630f5042c566c5c5b7e2"
};

let db = null;
try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
} catch (e) {
    console.warn("Firebase не ініціалізовано, працюємо локально", e);
}

// --------------------------------------------------
// ІГРОВІ ДАНІ
// --------------------------------------------------
const defaultState = {
    level: 1, exp: 0, gold: 0, statPoints: 0,
    stats: { str: 10, agi: 10, int: 10 },
    shadows: { infantry: 0, knight: 0, mage: 0 },
    equipment: { weaponLevel: 0 },
    monsterLevel: 1, monsterHp: 50
};

let game = null;
let monster = { level: 1, maxHp: 50, hp: 50 };

const monstersData = [
    { name: "Слабкий Гоблін", img: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Goblin.png" },
    { name: "Вовк Іклань", img: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Wolf.png" },
    { name: "Вищий Орк", img: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Ogre.png" },
    { name: "Лицар Смерті", img: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Skull.png" }
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
    { name: "Гнів Короля Демонів", cost: 25000, multiplier: 20.0 } 
];

// --------------------------------------------------
// БРОНЕБІЙНЕ ЗАВАНТАЖЕННЯ (Ніколи не зависне)
// --------------------------------------------------
function initGame() {
    document.getElementById('player-name').innerText = playerName;
    document.getElementById('player-avatar').src = avatarUrl;

    let hasStarted = false;

    // Функція фактичного старту гри
    function launch(data) {
        if (hasStarted) return; // Захист від подвійного старту
        hasStarted = true;
        
        game = data;
        
        // Відновлення монстра
        if (!game.monsterLevel) game.monsterLevel = game.level;
        if (!game.monsterHp) game.monsterHp = Math.floor(50 * Math.pow(1.5, game.monsterLevel - 1));
        monster.level = game.monsterLevel;
        monster.hp = game.monsterHp;

        // Ховаємо екран загрузки і показуємо гру
        document.getElementById('loading-screen').style.display = 'none';
        document.getElementById('game-container').style.display = 'flex';
        
        setMonsterData();
        updateUI();

        // Запуск ігрових циклів
        setInterval(() => {
            let dps = getShadowDPS();
            if (dps > 0) dealDamage(Math.max(1, dps / 10)); // 10 разів на секунду
        }, 100);

        setInterval(saveGame, 5000); // Збереження кожні 5 сек
    }

    // ТАЙМЕР-РЯТІВНИК: Якщо Firebase думає більше 1 секунди — стартуємо локально
    let emergencyTimer = setTimeout(() => {
        console.warn("Таймаут бази даних! Запуск локального збереження.");
        let local = JSON.parse(localStorage.getItem('soloSave')) || JSON.parse(JSON.stringify(defaultState));
        launch(local);
    }, 1000);

    // Спроба підключення до БД
    if (db) {
        db.ref('users/' + userId).once('value').then((snapshot) => {
            clearTimeout(emergencyTimer);
            if (snapshot.exists()) {
                launch(snapshot.val());
            } else {
                let local = JSON.parse(localStorage.getItem('soloSave')) || JSON.parse(JSON.stringify(defaultState));
                launch(local);
            }
        }).catch((error) => {
            clearTimeout(emergencyTimer);
            console.error("Помилка читання БД", error);
            let local = JSON.parse(localStorage.getItem('soloSave')) || JSON.parse(JSON.stringify(defaultState));
            launch(local);
        });
    }
}

// --------------------------------------------------
// МЕХАНІКА ГРИ
// --------------------------------------------------
function saveGame() {
    if (!game) return;
    game.monsterLevel = monster.level;
    game.monsterHp = monster.hp;
    
    // Завжди зберігаємо локально
    localStorage.setItem('soloSave', JSON.stringify(game));
    
    // Намагаємось відправити в хмару
    if (db) {
        let rInfo = getRank(game.level);
        db.ref('users/' + userId).set({
            username: playerName,
            avatar: avatarUrl,
            rank: rInfo.rank,
            level: game.level,
            exp: game.exp,
            gold: game.gold,
            stats: game.stats,
            equipmentLevel: game.equipment.weaponLevel,
            shadowsCount: game.shadows.infantry + game.shadows.knight + game.shadows.mage,
            monsterLevel: game.monsterLevel,
            monsterHp: game.monsterHp,
            lastActive: firebase.database.ServerValue.TIMESTAMP
        }).catch(()=>{});
    }
}

function getRank(level) {
    if (level < 10) return { rank: "E", color: "#9ca3af", shadow: "none" };
    if (level < 25) return { rank: "D", color: "#10b981", shadow: "0 0 5px #10b981" };
    if (level < 50) return { rank: "C", color: "#3b82f6", shadow: "0 0 8px #3b82f6" };
    if (level < 75) return { rank: "B", color: "#a855f7", shadow: "0 0 10px #a855f7" };
    if (level < 100) return { rank: "A", color: "#ef4444", shadow: "0 0 15px #ef4444" };
    return { rank: "S", color: "#fbbf24", shadow: "0 0 20px #fbbf24" };
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
    // Вібрація
    if (tg && tg.HapticFeedback) { try { tg.HapticFeedback.impactOccurred('light'); } catch(e) {} }
    
    let dmg = getClickDamage();
    let isCrit = Math.random() * 100 < getCritChance();
    
    if (isCrit) { 
        dmg *= 2; 
        if (tg && tg.HapticFeedback) { try { tg.HapticFeedback.impactOccurred('heavy'); } catch(e) {} } 
    }

    dealDamage(dmg);
    
    // Визначення координат для анімації (якщо клік пальцем/мишкою)
    let rect = document.getElementById('monster-container').getBoundingClientRect();
    let x = event.clientX ? event.clientX - rect.left : rect.width / 2;
    let y = event.clientY ? event.clientY - rect.top : rect.height / 2;
    
    showDamageText(x, y, dmg, isCrit);
    createSlashEffect(x, y);
    
    // Анімація удару по монстру
    const sprite = document.getElementById('monster-sprite');
    sprite.classList.remove('hit-shake'); 
    void sprite.offsetWidth; 
    sprite.classList.add('hit-shake');
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
    game.exp += 20 * monster.level; 
    game.gold += 5 * monster.level;
    
    checkLevelUp();
    
    monster.level += 1; 
    monster.hp = 0; 
    
    setMonsterData(); 
    saveGame(); 
    updateUI();
}

function checkLevelUp() {
    let maxExp = Math.floor(100 * Math.pow(1.3, game.level - 1));
    while (game.exp >= maxExp) {
        game.exp -= maxExp; 
        game.level++; 
        game.statPoints += 3;
        maxExp = Math.floor(100 * Math.pow(1.3, game.level - 1));
    }
}

// --------------------------------------------------
// КУПІВЛЯ ТА ІНТЕРФЕЙС
// --------------------------------------------------
function upgradeStat(stat) { 
    if (game.statPoints > 0) { game.stats[stat]++; game.statPoints--; updateUI(); saveGame(); } 
}
function buyShadow(type) { 
    let cost = Math.floor(shadowsData[type].baseCost * Math.pow(1.15, game.shadows[type])); 
    if (game.gold >= cost) { game.gold -= cost; game.shadows[type]++; updateUI(); saveGame(); } 
}
function buyWeapon() { 
    let nextWep = weaponData[game.equipment.weaponLevel]; 
    if (nextWep && game.gold >= nextWep.cost) { game.gold -= nextWep.cost; game.equipment.weaponLevel++; updateUI(); saveGame(); } 
}

function showDamageText(x, y, dmg, isCrit) {
    const text = document.createElement('div'); 
    text.className = `damage-text ${isCrit ? 'crit-text' : ''}`; 
    text.innerText = dmg;
    // Випадкове відхилення
    text.style.left = `${x + (Math.random() - 0.5) * 80 - 20}px`; 
    text.style.top = `${y - 40}px`;
    document.getElementById('monster-container').appendChild(text); 
    setTimeout(() => text.remove(), 700);
}

function createSlashEffect(x, y) {
    const slash = document.createElement('div'); 
    slash.className = 'slash-effect';
    slash.style.left = `${x - 70}px`; 
    slash.style.top = `${y}px`; 
    slash.style.transform = `rotate(${Math.random() * 360}deg)`;
    document.getElementById('monster-container').appendChild(slash); 
    setTimeout(() => slash.remove(), 150);
}

function switchTab(tabId) {
    document.getElementById('tab-stats').style.display = tabId === 'stats' ? 'block' : 'none';
    document.getElementById('tab-shadows').style.display = tabId === 'shadows' ? 'block' : 'none';
    document.getElementById('tab-gear').style.display = tabId === 'gear' ? 'block' : 'none';
    
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active')); 
    event.target.classList.add('active');
}

function renderShop() {
    // Тіні
    let shadowsHTML = '';
    for (const [key, data] of Object.entries(shadowsData)) {
        let cost = Math.floor(data.baseCost * Math.pow(1.15, game.shadows[key]));
        shadowsHTML += `
            <div class="shop-item">
                <div class="shop-item-info">
                    <h4>${data.name} [Lv.${game.shadows[key]}]</h4>
                    <p>DPS: ${data.dps}</p>
                </div>
                <button class="buy-btn" ${game.gold < cost ? 'disabled' : ''} onclick="buyShadow('${key}')">${cost} G</button>
            </div>`;
    }
    document.getElementById('shadows-list').innerHTML = shadowsHTML;

    // Зброя
    let eqHTML = ''; 
    let nextWep = weaponData[game.equipment.weaponLevel];
    if (nextWep) { 
        eqHTML = `
            <div class="shop-item">
                <div class="shop-item-info">
                    <h4>${nextWep.name}</h4>
                    <p>Урон: x${nextWep.multiplier}</p>
                </div>
                <button class="buy-btn" ${game.gold < nextWep.cost ? 'disabled' : ''} onclick="buyWeapon()">${nextWep.cost} G</button>
            </div>`; 
    } else { 
        eqHTML = `<div style="text-align:center; padding: 20px; color: var(--neon-blue); font-weight: bold;">Ви зібрали всю зброю!</div>`; 
    }
    document.getElementById('equipment-list').innerHTML = eqHTML;
}

function updateUI() {
    // Ранг
    let rInfo = getRank(game.level);
    let rankEl = document.getElementById('player-rank');
    rankEl.innerText = rInfo.rank;
    rankEl.style.color = rInfo.color;
    rankEl.style.borderColor = rInfo.color;
    rankEl.style.boxShadow = rInfo.shadow;

    // Статуси
    document.getElementById('level-display').innerText = game.level;
    document.getElementById('gold-display').innerText = Math.floor(game.gold);
    document.getElementById('click-dmg-display').innerText = getClickDamage();
    document.getElementById('dps-display').innerText = getShadowDPS();
    
    // Характеристики
    document.getElementById('stat-str').innerText = game.stats.str;
    document.getElementById('stat-agi').innerText = game.stats.agi;
    document.getElementById('stat-int').innerText = game.stats.int;
    document.getElementById('stat-points').innerText = game.statPoints;
    
    // Досвід
    let maxExp = Math.floor(100 * Math.pow(1.3, game.level - 1));
    document.getElementById('exp-bar').style.width = `${(game.exp / maxExp) * 100}%`;
    document.getElementById('exp-text').innerText = `${Math.floor(game.exp)} / ${maxExp} XP`;

    // Кнопки прокачки
    document.querySelectorAll('.up-btn').forEach(btn => { 
        btn.style.display = game.statPoints > 0 ? 'block' : 'none'; 
    });
    
    updateMonsterHPUI(); 
    renderShop();
}

// ЗАПУСК ГРИ
initGame();
