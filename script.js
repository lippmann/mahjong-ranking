// 用于存储所有用户数据
let players = [];
const MAX_PLAYERS_PER_GAME = 4;

// 页面加载时，尝试从 localStorage 加载数据
window.onload = function() {
    loadPlayers();
    renderRankings();
    checkGameSetup();
};

// === 用户管理 ===
function addPlayer() {
    const nameInput = document.getElementById('newPlayerName');
    const avatarInput = document.getElementById('newPlayerAvatar');
    const name = nameInput.value.trim();
    const avatar = avatarInput.value.trim() || 'default_avatar.png'; // 默认头像

    if (name === "") {
        alert("请输入用户名称！");
        return;
    }

    // 检查用户是否已存在
    if (players.find(p => p.name === name)) {
        alert("该用户名称已存在！");
        return;
    }

    players.push({
        id: Date.now(), // 使用时间戳作为唯一ID
        name: name,
        avatar: avatar,
        gamesPlayed: 0,
        totalScore: 0,
        averageScore: 0,
        wins: 0,    // 冠军 (第一名)
        seconds: 0, // 亚军 (第二名)
        thirds: 0,  // 季军 (第三名)
        fourths: 0, // 殿军 (第四名)
    });

    nameInput.value = ''; // 清空输入框
    avatarInput.value = '';

    savePlayers();
    renderRankings();
    checkGameSetup();
    alert(`用户 "${name}" 添加成功!`);
}

function deletePlayer(playerId) {
    if (!confirm("确定要删除该用户吗？其所有数据都将丢失！")) {
        return;
    }
    players = players.filter(p => p.id !== playerId);
    savePlayers();
    renderRankings();
    checkGameSetup();
}

// === 游戏记录 ===
function checkGameSetup() {
    const scoreEntrySection = document.getElementById('scoreEntrySection');
    const gamePlayersDiv = document.getElementById('gamePlayersDiv');

    if (players.length >= MAX_PLAYERS_PER_GAME) {
        scoreEntrySection.style.display = 'block';
        setupGamePlayersSelection(gamePlayersDiv);
    } else {
        scoreEntrySection.style.display = 'none';
        gamePlayersDiv.innerHTML = '<p>用户数量不足，请至少添加四名用户。</p>';
    }
}

function setupGamePlayersSelection(container) {
    container.innerHTML = ''; // 清空之前的选项
    const selectedPlayerIds = new Set(); // 确保玩家不重复选择

    for (let i = 0; i < MAX_PLAYERS_PER_GAME; i++) {
        const playerEntryDiv = document.createElement('div');
        playerEntryDiv.classList.add('player-score-entry');

        const selectLabel = document.createElement('label');
        selectLabel.textContent = `玩家 ${i + 1} (东/南/西/北):`;
        
        const selectPlayer = document.createElement('select');
        selectPlayer.id = `gamePlayer${i}`;
        
        const scoreInput = document.createElement('input');
        scoreInput.type = 'number';
        scoreInput.id = `gamePlayerScore${i}`;
        scoreInput.placeholder = '本局得分';

        // 填充可选玩家，排除已选的
        players.forEach(p => {
            const option = document.createElement('option');
            option.value = p.id;
            option.textContent = p.name;
            selectPlayer.appendChild(option);
        });
        
        // 确保默认选中的玩家不重复
        let defaultPlayerIndex = i;
        while(selectedPlayerIds.has(players[defaultPlayerIndex % players.length].id) && selectedPlayerIds.size < players.length) {
            defaultPlayerIndex++;
        }
        if (players[defaultPlayerIndex % players.length]) {
            selectPlayer.value = players[defaultPlayerIndex % players.length].id;
            selectedPlayerIds.add(players[defaultPlayerIndex % players.length].id);
        }
        
        // 当选择改变时，确保不重复选择其他已选玩家
        selectPlayer.onchange = () => handlePlayerSelectionChange(i);

        playerEntryDiv.appendChild(selectLabel);
        playerEntryDiv.appendChild(selectPlayer);
        playerEntryDiv.appendChild(scoreInput);
        container.appendChild(playerEntryDiv);
    }
    // 初始化时也调用一次，确保初始选择不冲突
    for (let i = 0; i < MAX_PLAYERS_PER_GAME; i++) {
        handlePlayerSelectionChange(i);
    }
}

function handlePlayerSelectionChange(selectedIndex) {
    const allSelects = [];
    for (let i = 0; i < MAX_PLAYERS_PER_GAME; i++) {
        allSelects.push(document.getElementById(`gamePlayer${i}`));
    }

    const selectedValues = new Set();
    // 优先保留用户手动选择的
    for (let i = 0; i < MAX_PLAYERS_PER_GAME; i++) {
        if (allSelects[i] && allSelects[i].dataset.manuallySelected === "true") {
            selectedValues.add(allSelects[i].value);
        }
    }
    
    // 然后处理其他下拉框
    for (let i = 0; i < MAX_PLAYERS_PER_GAME; i++) {
        const currentSelect = allSelects[i];
        if (!currentSelect) continue;

        // 如果当前值已经被其他手动选择的下拉框占用，并且不是自己
        if (selectedValues.has(currentSelect.value) && currentSelect.dataset.manuallySelected !== "true") {
             // 尝试为当前下拉框找到一个未被占用的值
            for (const p of players) {
                if (!selectedValues.has(p.id.toString())) {
                    currentSelect.value = p.id.toString();
                    selectedValues.add(p.id.toString());
                    break;
                }
            }
        } else {
            selectedValues.add(currentSelect.value);
        }
         // 标记为非手动选择，除非它就是当前操作的
        if (i === selectedIndex) {
            currentSelect.dataset.manuallySelected = "true";
        } else if (currentSelect.dataset.manuallySelected !== "true") {
             // 如果其他select的值需要改变，取消它的手动标记
        }
    }

    // 如果上面逻辑未能完全解决（理论上不应该，但作为保险），重新标记所有
    const finalSelectedValues = new Set();
    allSelects.forEach(sel => {
        if(sel) {
            if(finalSelectedValues.has(sel.value)) {
                // 这个逻辑需要更完善的查找下一个可用值
                console.warn("Duplicate selection detected post-correction attempt for:", sel.id);
            }
            finalSelectedValues.add(sel.value);
        }
    });
}


function recordGame() {
    const gameData = [];
    let totalGameScore = 0;
    const selectedPlayerIdsInGame = new Set();

    for (let i = 0; i < MAX_PLAYERS_PER_GAME; i++) {
        const playerSelect = document.getElementById(`gamePlayer${i}`);
        const scoreInput = document.getElementById(`gamePlayerScore${i}`);
        
        if (!playerSelect || !scoreInput) {
            alert(`错误：找不到玩家 ${i+1} 的输入栏位。`);
            return;
        }

        const playerId = parseInt(playerSelect.value);
        const score = parseInt(scoreInput.value);

        if (isNaN(score)) {
            alert(`请输入玩家 ${playerSelect.options[playerSelect.selectedIndex].text} 的有效分数！`);
            return;
        }
        if (selectedPlayerIdsInGame.has(playerId)) {
            alert(`玩家 "${playerSelect.options[playerSelect.selectedIndex].text}" 被重复选择，请为每位玩家选择不同的用户！`);
            return;
        }
        selectedPlayerIdsInGame.add(playerId);

        gameData.push({ playerId, score });
        totalGameScore += score;
    }

    if (totalGameScore !== 0) {
        alert(`本局四家总分 (${totalGameScore}) 不为零，请检查输入分数！`);
        return;
    }

    // 根据分数对本局玩家进行排序，以确定名次
    gameData.sort((a, b) => b.score - a.score); // 分数从高到低

    gameData.forEach((data, index) => {
        const player = players.find(p => p.id === data.playerId);
        if (player) {
            player.gamesPlayed += 1;
            player.totalScore += data.score;
            player.averageScore = player.totalScore / player.gamesPlayed;

            // 更新冠亚季殿次数
            if (index === 0) player.wins += 1;       // 冠军
            else if (index === 1) player.seconds += 1; // 亚军
            else if (index === 2) player.thirds += 1;  // 季军
            else if (index === 3) player.fourths += 1; // 殿军
        }
    });

    savePlayers();
    renderRankings();
    // 清空分数输入框
    for (let i = 0; i < MAX_PLAYERS_PER_GAME; i++) {
        const scoreInput = document.getElementById(`gamePlayerScore${i}`);
        if (scoreInput) scoreInput.value = '';
    }
    alert("本局分数记录成功！");
}

// === 排名渲染 ===
function renderRankings() {
    const sortCriteria = document.getElementById('sortCriteria').value;
    let sortedPlayers = [...players]; // 创建副本进行排序

    sortedPlayers.sort((a, b) => {
        if (sortCriteria === 'averageScore') {
            // 平均分高的在前，如果场次为0，则平均分视为负无穷小
            const avgA = a.gamesPlayed > 0 ? a.averageScore : -Infinity;
            const avgB = b.gamesPlayed > 0 ? b.averageScore : -Infinity;
            if (avgB !== avgA) return avgB - avgA;
        } else if (sortCriteria === 'gamesPlayed') {
            if (b.gamesPlayed !== a.gamesPlayed) return b.gamesPlayed - a.gamesPlayed;
        } else if (sortCriteria === 'wins') {
            if (b.wins !== a.wins) return b.wins - a.wins;
        }
        // 默认按总分排序 (totalScore)，或作为次要排序标准
        return b.totalScore - a.totalScore;
    });

    const tableBody = document.getElementById('rankingsTable').getElementsByTagName('tbody')[0];
    tableBody.innerHTML = ''; // 清空现有排名

    if (sortedPlayers.length === 0) {
        const row = tableBody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 11; // 合并所有列
        cell.textContent = '暂无用户数据，请先添加用户。';
        cell.style.textAlign = 'center';
        return;
    }
    
    sortedPlayers.forEach((player, index) => {
        const row = tableBody.insertRow();
        row.insertCell().textContent = index + 1; // 排名
        
        const avatarCell = row.insertCell();
        const avatarImg = document.createElement('img');
        avatarImg.src = player.avatar;
        avatarImg.alt = player.name;
        avatarImg.classList.add('avatar-img');
        avatarImg.onerror = function() { this.src = 'default_avatar.png'; }; // 备用头像
        avatarCell.appendChild(avatarImg);

        row.insertCell().textContent = player.name;
        row.insertCell().textContent = player.gamesPlayed;
        row.insertCell().textContent = player.totalScore;
        row.insertCell().textContent = player.gamesPlayed > 0 ? player.averageScore.toFixed(2) : 'N/A';
        row.insertCell().textContent = player.wins;
        row.insertCell().textContent = player.seconds;
        row.insertCell().textContent = player.thirds;
        row.insertCell().textContent = player.fourths;
        
        const deleteCell = row.insertCell();
        const deleteButton = document.createElement('button');
        deleteButton.textContent = '删除';
        deleteButton.classList.add('delete-btn');
        deleteButton.onclick = function() { deletePlayer(player.id); };
        deleteCell.appendChild(deleteButton);
    });
}

// === 本地存储 ===
function savePlayers() {
    localStorage.setItem('mahjongPlayers', JSON.stringify(players));
}

function loadPlayers() {
    const storedPlayers = localStorage.getItem('mahjongPlayers');
    if (storedPlayers) {
        players = JSON.parse(storedPlayers);
    }
}

// (可选) 创建一个默认头像图片 default_avatar.png 放在项目根目录，或者使用一个在线链接
// 例如: https://via.placeholder.com/40 (这是一个占位图片服务)
// 你可以把上面代码中的 'default_avatar.png' 替换成这个链接
// 例如: const avatar = avatarInput.value.trim() || 'https://via.placeholder.com/40?text=P';
// 为简单起见，你可以先不处理图片，或者手动找个图片链接作为默认