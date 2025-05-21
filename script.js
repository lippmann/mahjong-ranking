// 在这里粘贴你从 Firebase 控制台复制的 firebaseConfig 对象！

const firebaseConfig = {
  apiKey: "AIzaSyBpze8FuqpSp6syG597RfgoBpGAD-vskk0",
  authDomain: "mahjong-rankings.firebaseapp.com",
  projectId: "mahjong-rankings",
  storageBucket: "mahjong-rankings.firebasestorage.app",
  messagingSenderId: "460992688961",
  appId: "1:460992688961:web:07b3b9f401c2109cae27c0",
  measurementId: "G-TNVW5PCTQE"
};

// 例如:
// const firebaseConfig = {
//   apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXX",
//   authDomain: "your-project-id.firebaseapp.com",
//   projectId: "your-project-id",
//   storageBucket: "your-project-id.appspot.com",
//   messagingSenderId: "000000000000",
//   appId: "1:000000000000:web:xxxxxxxxxxxxxxxxxxxxxx"
// };

// 请务必将上面的注释部分替换为你自己的 Firebase 配置！！！
// 如果 firebaseConfig 没有被正确替换，应用将无法连接到 Firebase。
if (typeof firebaseConfig === 'undefined' || firebaseConfig.apiKey === "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXX") {
    alert("重要提示：请在 script.js 文件顶部正确配置 firebaseConfig 对象！否则应用无法连接到数据库。");
    console.error("Firebase config is not set or is using placeholder values.");
}


// 初始化 Firebase 应用
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore(); // 获取 Firestore 数据库实例
const playersCollection = db.collection("players"); // 'players' 是你在 Firestore 中的集合名称

// 全局变量
let players = []; // 本地缓存的玩家数据，由 Firestore 实时更新
const MAX_PLAYERS_PER_GAME = 4;
const DEFAULT_AVATAR = 'https://via.placeholder.com/50/007bff/FFFFFF?Text=M';

// 页面加载完成后执行初始化操作
window.onload = async function() {
    // 监听 Firestore 中 players 集合的实时变化
    playersCollection.onSnapshot(snapshot => {
        players = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("Players data loaded/updated from Firestore:", players);
        renderRankings();
        checkGameSetup();
    }, error => {
        console.error("Error fetching players from Firestore: ", error);
        alert("无法从数据库加载玩家数据，请检查网络连接或 Firebase 设置。");
    });

    document.getElementById('currentYear').textContent = new Date().getFullYear();
};

/**
 * 添加新玩家到 Firestore
 */
async function addPlayer() {
    const nameInput = document.getElementById('newPlayerName');
    const avatarInput = document.getElementById('newPlayerAvatar');
    const name = nameInput.value.trim();
    let avatar = avatarInput.value.trim();

    if (name === "") {
        alert("请输入用户名称！");
        return;
    }

    // 检查用户是否已存在 (基于本地缓存，Firestore 规则可以做得更严格)
    if (players.find(p => p.name === name)) {
        alert("该用户名称已存在，请使用其他名称！");
        return;
    }

    if (avatar === "") {
        avatar = DEFAULT_AVATAR;
    }

    const newPlayerData = {
        name: name,
        avatar: avatar,
        gamesPlayed: 0,
        totalScore: 0,
        averageScore: 0,
        wins: 0,
        seconds: 0,
        thirds: 0,
        fourths: 0,
        // history: [], // 如果需要历史记录
        createdAt: firebase.firestore.FieldValue.serverTimestamp() // 记录创建时间
    };

    try {
        const docRef = await playersCollection.add(newPlayerData);
        console.log("Player added with ID: ", docRef.id);
        nameInput.value = '';
        avatarInput.value = '';
        alert(`用户 "${name}" 添加成功!`);
        // onSnapshot 会自动处理UI更新，所以不需要手动调用 renderRankings 和 checkGameSetup
    } catch (error) {
        console.error("Error adding player to Firestore: ", error);
        alert("添加用户失败，请检查网络或稍后再试。");
    }
}

/**
 * 从 Firestore 删除玩家
 * @param {string} playerId - 要删除的玩家文档ID
 */
async function deletePlayer(playerId) {
    const playerToDelete = players.find(p => p.id === playerId);
    if (!playerToDelete) return;

    if (!confirm(`确定要删除用户 "${playerToDelete.name}" 吗？其所有数据都将丢失！`)) {
        return;
    }

    try {
        await playersCollection.doc(playerId).delete();
        console.log("Player deleted with ID: ", playerId);
        // onSnapshot 会自动处理UI更新
    } catch (error) {
        console.error("Error deleting player from Firestore: ", error);
        alert("删除用户失败，请检查网络或稍后再试。");
    }
}

/**
 * 检查是否可以设置游戏，并更新UI
 * 这个函数现在依赖于由 onSnapshot 更新的全局 players 数组
 */
function checkGameSetup() {
    const scoreEntrySection = document.getElementById('scoreEntrySection');
    const gamePlayersDiv = document.getElementById('gamePlayersDiv');

    if (players.length >= MAX_PLAYERS_PER_GAME) {
        scoreEntrySection.style.display = 'block';
        setupGamePlayersSelection(gamePlayersDiv);
    } else {
        scoreEntrySection.style.display = 'none';
        gamePlayersDiv.innerHTML = `<p class="instructions">用户数量不足 ${MAX_PLAYERS_PER_GAME} 人，请先添加更多用户。</p>`;
    }
}

/**
 * 设置游戏玩家选择和分数输入区域
 * @param {HTMLElement} container - 容纳玩家选择表单的DOM元素
 */
function setupGamePlayersSelection(container) {
    container.innerHTML = ''; // 清空之前的选项

    // 获取当前已选中的玩家ID，避免在生成下拉框时重复
    const currentlySelectedInUI = [];
    for (let i = 0; i < MAX_PLAYERS_PER_GAME; i++) {
        const existingSelect = document.getElementById(`gamePlayer${i}`);
        if (existingSelect && existingSelect.value) {
            currentlySelectedInUI.push(existingSelect.value);
        }
    }

    for (let i = 0; i < MAX_PLAYERS_PER_GAME; i++) {
        const playerEntryDiv = document.createElement('div');
        playerEntryDiv.classList.add('player-score-entry');

        const selectLabel = document.createElement('label');
        selectLabel.textContent = `玩家 ${i + 1} (东/南/西/北):`;
        selectLabel.htmlFor = `gamePlayer${i}`;
        
        const selectPlayer = document.createElement('select');
        selectPlayer.id = `gamePlayer${i}`;
        selectPlayer.classList.add('select-dropdown');
        selectPlayer.onchange = () => handlePlayerSelectionChange();

        // 过滤掉其他下拉框已选的玩家，除非是当前下拉框之前选中的
        const availablePlayers = players.filter(p => 
            !currentlySelectedInUI.includes(p.id) || (selectPlayer.value && selectPlayer.value === p.id)
        );

        // 如果没有可用玩家（理论上不应发生，除非玩家少于4人），则填充所有玩家
        const playersToPopulate = availablePlayers.length >= (MAX_PLAYERS_PER_GAME - i) || players.length < MAX_PLAYERS_PER_GAME ? players : availablePlayers;


        playersToPopulate.forEach(p => {
            const option = document.createElement('option');
            option.value = p.id;
            option.textContent = p.name;
            selectPlayer.appendChild(option);
        });
        
        // 尝试设置不重复的默认玩家
        // 优先使用之前UI上已选的值，如果它仍然有效
        const previousValue = document.getElementById(`gamePlayer${i}`)?.value;
        if (previousValue && players.find(p => p.id === previousValue)) {
            selectPlayer.value = previousValue;
        } else if (players.length > i && !currentlySelectedInUI.includes(players[i % players.length].id)) {
             // 否则，尝试按顺序分配一个未被选中的玩家
            let playerIndex = 0;
            let found = false;
            while(playerIndex < players.length) {
                const potentialPlayerId = players[playerIndex].id;
                if (!currentlySelectedInUI.find(id => id === potentialPlayerId)) {
                    selectPlayer.value = potentialPlayerId;
                    currentlySelectedInUI.push(potentialPlayerId); // 标记为已用
                    found = true;
                    break;
                }
                playerIndex++;
            }
            if(!found && players.length > 0) { // 如果都冲突了，随便选一个
                 selectPlayer.value = players[0].id;
            }

        } else if (players.length > 0) { // 如果玩家数量不足，或者前面都冲突了
            selectPlayer.value = players[0].id; // 随便选一个
        }
        
        const scoreInput = document.createElement('input');
        scoreInput.type = 'number';
        scoreInput.id = `gamePlayerScore${i}`;
        scoreInput.placeholder = '本局得分';
        scoreInput.oninput = updateTotalScoreMessage;

        playerEntryDiv.appendChild(selectLabel);
        playerEntryDiv.appendChild(selectPlayer);
        playerEntryDiv.appendChild(scoreInput);
        container.appendChild(playerEntryDiv);
    }
    handlePlayerSelectionChange();
    updateTotalScoreMessage();
}


/**
 * 处理玩家选择变化，确保不重复选择
 */
function handlePlayerSelectionChange() {
    const selects = [];
    for (let i = 0; i < MAX_PLAYERS_PER_GAME; i++) {
        const selectElement = document.getElementById(`gamePlayer${i}`);
        if (selectElement) selects.push(selectElement);
    }

    const selectedValues = new Set();
    let duplicateFound = false;

    // 检查是否有重复
    for (const s of selects) {
        if (selectedValues.has(s.value)) {
            duplicateFound = true;
            break;
        }
        selectedValues.add(s.value);
    }

    if (duplicateFound) {
        alert("提示：有玩家被重复选择。请为每位玩家选择不同的用户。");
        // 简单的处理：当检测到重复时，尝试为“导致”重复的那个select重新赋值
        // 这个逻辑可以更完善，例如高亮冲突的选项等
        const tempSelected = new Set();
        for (const s of selects) {
            if (tempSelected.has(s.value)) { // 当前s的值造成了重复
                // 尝试为 s 找到一个未被选中的值
                for (const p of players) {
                    if (!tempSelected.has(p.id)) {
                        s.value = p.id; // 更改为第一个未被选中的玩家
                        break;
                    }
                }
            }
            tempSelected.add(s.value);
        }
    }
}


/**
 * 更新显示当前输入分数的总和
 */
function updateTotalScoreMessage() {
    const scoreSumMessage = document.getElementById('scoreSumMessage');
    if (!scoreSumMessage) return;

    let currentTotal = 0;
    let allScoresEntered = true;
    for (let i = 0; i < MAX_PLAYERS_PER_GAME; i++) {
        const scoreInput = document.getElementById(`gamePlayerScore${i}`);
        if (scoreInput && scoreInput.value !== '') {
            currentTotal += parseInt(scoreInput.value) || 0;
        } else if (scoreInput) {
            allScoresEntered = false;
        }
    }
    
    if (!allScoresEntered && currentTotal === 0 && Array.from(document.querySelectorAll('.game-players-grid input[type="number"]')).every(inp => inp.value === '')) {
        scoreSumMessage.textContent = '请输入各家得分。';
        scoreSumMessage.className = 'score-sum-message';
        return;
    }

    scoreSumMessage.textContent = `当前四家总分: ${currentTotal}`;
    if (currentTotal === 0 && allScoresEntered) {
        scoreSumMessage.classList.add('success');
        scoreSumMessage.classList.remove('error');
    } else {
        scoreSumMessage.classList.add('error');
        scoreSumMessage.classList.remove('success');
    }
}

/**
 * 记录一局游戏的分数，并更新到 Firestore
 */
async function recordGame() {
    const gameDataForUpdate = []; // 存储玩家ID和需要更新的字段
    const gameScoresInput = []; // 存储本局选择的玩家ID和分数，用于校验
    let totalGameScore = 0;
    const selectedPlayerIdsInGame = new Set();

    for (let i = 0; i < MAX_PLAYERS_PER_GAME; i++) {
        const playerSelect = document.getElementById(`gamePlayer${i}`);
        const scoreInput = document.getElementById(`gamePlayerScore${i}`);
        
        if (!playerSelect || !scoreInput) {
            alert(`错误：找不到玩家 ${i+1} 的输入栏位。`);
            return;
        }

        const playerId = playerSelect.value; // Firestore ID 是字符串
        const scoreString = scoreInput.value;

        if (scoreString === "" || isNaN(parseInt(scoreString))) {
            alert(`请输入玩家 "${playerSelect.options[playerSelect.selectedIndex].text}" 的有效分数！`);
            return;
        }
        const score = parseInt(scoreString);

        if (selectedPlayerIdsInGame.has(playerId)) {
            alert(`玩家 "${playerSelect.options[playerSelect.selectedIndex].text}" 被重复选择，请为每位玩家选择不同的用户！`);
            return;
        }
        selectedPlayerIdsInGame.add(playerId);

        gameScoresInput.push({ playerId, score, name: playerSelect.options[playerSelect.selectedIndex].text });
        totalGameScore += score;
    }

    if (totalGameScore !== 0) {
        alert(`本局四家总分 (${totalGameScore}) 不为零，麻将规则要求总分为零，请检查输入分数！`);
        const scoreSumMessage = document.getElementById('scoreSumMessage');
        if (scoreSumMessage) {
             scoreSumMessage.textContent = `总分必须为0，当前: ${totalGameScore}`;
             scoreSumMessage.className = 'score-sum-message error';
        }
        return;
    }

    // 根据分数对本局玩家进行排序
    gameScoresInput.sort((a, b) => b.score - a.score);

    // 准备批量更新 Firestore
    const batch = db.batch();

    gameScoresInput.forEach((data, index) => {
        const playerDocRef = playersCollection.doc(data.playerId);
        const playerCurrentData = players.find(p => p.id === data.playerId); // 从本地缓存获取当前数据

        if (playerCurrentData) {
            const newGamesPlayed = playerCurrentData.gamesPlayed + 1;
            const newTotalScore = playerCurrentData.totalScore + data.score;
            
            const updateData = {
                gamesPlayed: newGamesPlayed,
                totalScore: newTotalScore,
                averageScore: newTotalScore / newGamesPlayed,
                wins: playerCurrentData.wins + (index === 0 ? 1 : 0),
                seconds: playerCurrentData.seconds + (index === 1 ? 1 : 0),
                thirds: playerCurrentData.thirds + (index === 2 ? 1 : 0),
                fourths: playerCurrentData.fourths + (index === 3 ? 1 : 0),
            };
            batch.update(playerDocRef, updateData);
        }
    });

    try {
        await batch.commit();
        console.log("Game scores recorded and players updated in Firestore.");
        // 清空分数输入框
        for (let i = 0; i < MAX_PLAYERS_PER_GAME; i++) {
            const scoreInput = document.getElementById(`gamePlayerScore${i}`);
            if (scoreInput) scoreInput.value = '';
        }
        updateTotalScoreMessage();
        alert("本局分数记录成功！");
        // onSnapshot 会自动更新排名
    } catch (error) {
        console.error("Error recording game to Firestore: ", error);
        alert("记录本局分数失败，请检查网络或稍后再试。");
    }
}


/**
 * 渲染排名列表到表格
 * 这个函数现在依赖于由 onSnapshot 更新的全局 players 数组
 */
function renderRankings() {
    const sortCriteria = document.getElementById('sortCriteria').value;
    let sortedPlayers = [...players];

    sortedPlayers.sort((a, b) => {
        switch (sortCriteria) {
            case 'averageScore':
                const avgA = a.gamesPlayed > 0 ? a.averageScore : -Infinity;
                const avgB = b.gamesPlayed > 0 ? b.averageScore : -Infinity;
                if (avgB !== avgA) return avgB - avgA;
                return b.totalScore - a.totalScore;
            case 'gamesPlayed':
                if (b.gamesPlayed !== a.gamesPlayed) return b.gamesPlayed - a.gamesPlayed;
                return b.totalScore - a.totalScore;
            case 'wins':
                if (b.wins !== a.wins) return b.wins - a.wins;
                return b.totalScore - a.totalScore;
            case 'totalScore':
            default:
                return b.totalScore - a.totalScore;
        }
    });

    const tableBody = document.getElementById('rankingsTable').getElementsByTagName('tbody')[0];
    tableBody.innerHTML = '';

    if (sortedPlayers.length === 0) {
        const row = tableBody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 11;
        cell.textContent = '暂无用户数据，请先在上方添加用户。';
        cell.style.textAlign = 'center';
        return;
    }
    
    sortedPlayers.forEach((player, index) => {
        const row = tableBody.insertRow();
        row.insertCell().textContent = index + 1;
        
        const avatarCell = row.insertCell();
        const avatarImg = document.createElement('img');
        avatarImg.src = player.avatar || DEFAULT_AVATAR; // 使用 player.avatar，如果不存在则用默认
        avatarImg.alt = player.name;
        avatarImg.classList.add('avatar-img');
        avatarImg.onerror = function() {
            this.src = DEFAULT_AVATAR; 
            this.alt = '默认头像';
        };
        avatarCell.appendChild(avatarImg);

        row.insertCell().textContent = player.name;
        row.insertCell().textContent = player.gamesPlayed;
        row.insertCell().textContent = player.totalScore;
        row.insertCell().textContent = player.gamesPlayed > 0 ? player.averageScore.toFixed(2) : 'N/A';
        row.insertCell().textContent = player.wins;
        row.insertCell().textContent = player.seconds;
        row.insertCell().textContent = player.thirds;
        row.insertCell().textContent = player.fourths;
        
        const actionCell = row.insertCell();
        const deleteButton = document.createElement('button');
        deleteButton.innerHTML = '<i class="fas fa-trash-alt"></i> 删除';
        deleteButton.classList.add('btn', 'btn-danger');
        deleteButton.onclick = function() { deletePlayer(player.id); }; // player.id 是 Firestore 文档 ID
        actionCell.appendChild(deleteButton);
    });
}

// 注意：不再需要 savePlayers() 和 loadPlayers() 函数，因为数据由 Firestore 管理并通过 onSnapshot 实时同步。
