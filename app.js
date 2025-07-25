import React, { useState, useEffect } from 'react';
import { ChevronDown, Users, Play, BarChart3, RotateCcw, Shield, AlertCircle, Skull, ArrowLeft, Undo, ArrowUpDown, ArrowLeftRight, Pause, PlayCircle, Timer, ChevronLeft, ChevronRight } from 'lucide-react';

// ゲームルールの定義
const GameRules = {
  '9ボール': {
    ballCount: 9,
    endBall: 9,
    isJCL: false,
    defaultTarget: 3,
    targetUnit: 'ラック数',
    calculateScore: (currentScore, selectedBalls, currentPlayer, gameState) => {
      // 通常の9ボール：9番を落としたら1点
      if (selectedBalls.includes(9)) {
        return currentScore + 1;
      }
      return currentScore;
    },
    checkGameEnd: (selectedBalls) => selectedBalls.includes(9),
    getInitialBalls: () => Array.from({ length: 9 }, (_, i) => i + 1),
    getRackEndMessage: (currentPlayer, gameSettings) => null,
    shouldResetRack: (selectedBalls) => selectedBalls.includes(9),
  },
  
  'JPA9ボール': {
    ballCount: 9,
    endBall: 9,
    isJCL: false,
    defaultTarget: 14,
    targetUnit: '点数',
    calculateScore: (currentScore, selectedBalls, currentPlayer, gameState) => {
      // JPA9ボール：1-8番は各1点、9番は2点
      let points = 0;
      selectedBalls.forEach(ball => {
        if (ball >= 1 && ball <= 8) {
          points += 1;
        } else if (ball === 9) {
          points += 2;
        }
      });
      return currentScore + points;
    },
    checkGameEnd: (selectedBalls) => false, // 9番を落としてもラックは終了しない（点数制のため）
    getInitialBalls: () => Array.from({ length: 9 }, (_, i) => i + 1),
    getRackEndMessage: (currentPlayer, gameSettings) => null,
    shouldResetRack: (selectedBalls) => selectedBalls.includes(9),
  },
  
  'JCL9ボール': {
    ballCount: 9,
    endBall: 9,
    isJCL: true,
    defaultTarget: 50, // 通常の50点に戻す
    targetUnit: '点数',
    calculateScore: (currentScore, selectedBalls, currentPlayer, gameState) => {
      // JCL9ボール：複雑な得点計算は別途処理
      return currentScore; // JCL用の特別な処理で更新
    },
    checkGameEnd: (selectedBalls) => selectedBalls.includes(9),
    getInitialBalls: () => Array.from({ length: 9 }, (_, i) => i + 1),
    getRackEndMessage: (currentPlayer, gameSettings, winner9Points, opponentPoints) => {
      const winner9Name = currentPlayer === 1 ? gameSettings.player1.name : gameSettings.player2.name;
      return `${winner9Name}が9番ポケット！ +${winner9Points}点 (相手: +${opponentPoints}点)`;
    },
    shouldResetRack: (selectedBalls) => selectedBalls.includes(9),
    // JCL特有の得点計算
    calculateJCLScore: (currentPlayer, player1RackBalls, player2RackBalls) => {
      const winner9Points = 14;
      const opponentPoints = currentPlayer === 1 ? player2RackBalls : player1RackBalls;
      
      return {
        winner9Points,
        opponentPoints,
        player1Score: currentPlayer === 1 ? winner9Points : opponentPoints,
        player2Score: currentPlayer === 2 ? winner9Points : opponentPoints
      };
    }
  }
};

const BilliardsApp = () => {
  const [currentScreen, setCurrentScreen] = useState('home');
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [players, setPlayers] = useState([
    { id: 1, name: 'プレイヤー1', gamesPlayed: 0, gamesWon: 0, totalShots: 0, successfulShots: 0, massWari: 0, totalBallsPocketed: 0, totalInnings: 0, totalSafeties: 0, totalFouls: 0 },
    { id: 2, name: 'プレイヤー2', gamesPlayed: 0, gamesWon: 0, totalShots: 0, successfulShots: 0, massWari: 0, totalBallsPocketed: 0, totalInnings: 0, totalSafeties: 0, totalFouls: 0 }
  ]);
  const [gameSettings, setGameSettings] = useState({
    gameType: '9ボール',
    player1: null,
    player2: null,
    player1Target: 3,
    player2Target: 3,
    isJCL: false,
    breakRule: 'winner', // 'winner' or 'alternate'
    threeFoulRule: true, // 3ファウルルールのあり/なし
    useChessClock: false, // チェスクロック＆ショットクロックの使用
    chessClockMinutes: 25, // チェスクロックの分数
    shotClockSeconds: 40, // ショットクロックの秒数
    extensionSeconds: 40, // エクステンションで追加される秒数
    operationMode: 'custom' // 'simple' or 'custom' - JCL9ボール用の操作モード
  });
  const [gameState, setGameState] = useState({
    currentPlayer: 1,
    player1Score: 0,
    player2Score: 0,
    ballsOnTable: [],
    deadBalls: [],
    shotCount: 0,
    currentRackShots: 0,
    gameHistory: [],
    deadMode: false,
    player1Fouls: 0,
    player2Fouls: 0,
    actionHistory: [],
    currentRack: 1,
    currentInning: 1,
    shotInProgress: false,
    selectedBallsInShot: [],
    player1Stats: {
      totalBallsPocketed: 0,
      totalInnings: 0,
      massWari: 0,
      inningStats: [],
      shotsInGame: 0,  // ゲーム内のショット数を追加
      safetiesInGame: 0,  // ゲーム内のセーフティ数を追加
      foulsInGame: 0  // ゲーム内のファウル数を追加
    },
    player2Stats: {
      totalBallsPocketed: 0,
      totalInnings: 0,
      massWari: 0,
      inningStats: [],
      shotsInGame: 0,  // ゲーム内のショット数を追加
      safetiesInGame: 0,  // ゲーム内のセーフティ数を追加
      foulsInGame: 0  // ゲーム内のファウル数を追加
    },
    currentInningBalls: 0,
    isNewInning: true,
    pocketedByPlayer: {},
    currentInningPerfect: true,
    currentInningStartBalls: 0,
    player1RackBalls: 0,
    player2RackBalls: 0,
    isHillHill: false, // ヒルヒル状態フラグを追加
    startTime: '',
    breakRule: 'winner', // ブレイクルール
    threeFoulRule: true, // 3ファウルルール
    lastRackWinner: null, // 前のラックの勝者
    // チェスクロック関連
    useChessClock: false,
    player1ChessTime: 25 * 60, // 25分（秒）
    player2ChessTime: 25 * 60, // 25分（秒）
    shotClockTime: 40, // 40秒
    player1Extensions: 1, // エクステンション残り回数
    player2Extensions: 1, // エクステンション残り回数
    isClockPaused: false, // クロック一時停止
    player1IsUsingShootClock: false, // プレイヤー1のショットクロックモード
    player2IsUsingShootClock: false, // プレイヤー2のショットクロックモード
    clockStartTime: null, // クロック開始時刻
    operationMode: 'custom' // 操作モード
  });
  const [newPlayerName, setNewPlayerName] = useState('');
  const [showNewPlayerForm, setShowNewPlayerForm] = useState(false);
  const [gameResult, setGameResult] = useState(null);
  const [draggedBall, setDraggedBall] = useState(null);
  const [dragDirection, setDragDirection] = useState(null);

  // ボールの色定義（よりプレミアムな色調に調整）
  const ballColors = {
    1: '#DAA520', // ゴールド
    2: '#003366', // ネイビーブルー
    3: '#8B0000', // ダークレッド
    4: '#4B0082', // インディゴ
    5: '#CC5500', // バーントオレンジ
    6: '#2E4E3E', // フォレストグリーン
    7: '#5D4037', // ブラウン
    8: '#000000', // ブラック
    9: '#DAA520', // ゴールド（ストライプ）
    10: '#003366', // ネイビーブルー（ストライプ）
    11: '#8B0000', // ダークレッド（ストライプ）
    12: '#4B0082', // インディゴ（ストライプ）
    13: '#CC5500', // バーントオレンジ（ストライプ）
    14: '#2E4E3E', // フォレストグリーン（ストライプ）
    15: '#5D4037'  // ブラウン（ストライプ）
  };

  // 新規ゲーム画面を開いたときにプレイヤーをプリセット
  useEffect(() => {
    if (currentScreen === 'newGame' && (!gameSettings.player1 || !gameSettings.player2)) {
      setGameSettings(prev => ({
        ...prev,
        player1: players.find(p => p.id === 1) || null,
        player2: players.find(p => p.id === 2) || null
      }));
    }
  }, [currentScreen, players]);

  // 現在のゲームルールを取得
  const getCurrentRule = () => GameRules[gameSettings.gameType] || GameRules['9ボール'];

  // 時間フォーマット関数
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // チェスクロックのカウントダウン
  useEffect(() => {
    if (!gameState.useChessClock || gameState.isClockPaused || currentScreen !== 'game') {
      return;
    }

    const shotClockSeconds = gameSettings.shotClockSeconds;
    
    const interval = setInterval(() => {
      setGameState(prev => {
        const currentPlayerKey = prev.currentPlayer === 1 ? 'player1ChessTime' : 'player2ChessTime';
        const currentTime = prev[currentPlayerKey];
        const isCurrentPlayerUsingShootClock = prev.currentPlayer === 1 ? prev.player1IsUsingShootClock : prev.player2IsUsingShootClock;

        // 現在のプレイヤーのチェスクロックが0になった場合
        if (currentTime <= 0 && !isCurrentPlayerUsingShootClock) {
          return {
            ...prev,
            [`player${prev.currentPlayer}IsUsingShootClock`]: true,
            shotClockTime: shotClockSeconds
          };
        }

        // ショットクロックが0になった場合でも、何もしない（目安として使用）
        if (isCurrentPlayerUsingShootClock && prev.shotClockTime <= 0) {
          return prev; // 0のまま表示を維持
        }

        // 時間を減算
        if (isCurrentPlayerUsingShootClock) {
          return {
            ...prev,
            shotClockTime: Math.max(0, prev.shotClockTime - 1) // 0以下にはならないようにする
          };
        } else {
          return {
            ...prev,
            [currentPlayerKey]: currentTime - 1
          };
        }
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState.useChessClock, gameState.isClockPaused, gameState.currentPlayer, currentScreen, gameSettings.shotClockSeconds]);

  // 一時停止トグル
  const toggleClockPause = () => {
    setGameState(prev => ({
      ...prev,
      isClockPaused: !prev.isClockPaused
    }));
  };

  // エクステンション使用
  const useExtension = () => {
    const extensionKey = gameState.currentPlayer === 1 ? 'player1Extensions' : 'player2Extensions';
    if (gameState[extensionKey] > 0) {
      const extensionSeconds = gameSettings.extensionSeconds;
      setGameState(prev => ({
        ...prev,
        shotClockTime: prev.shotClockTime + extensionSeconds,
        [extensionKey]: prev[extensionKey] - 1
      }));
    }
  };

  // ヒルヒル判定（JCL9ボール専用）
  const checkHillHill = (player1Score, player2Score, player1Target, player2Target) => {
    const player1Remaining = player1Target - player1Score;
    const player2Remaining = player2Target - player2Score;
    const isHillHill = player1Remaining <= 14 && player2Remaining <= 14;
    console.log('=== ヒルヒル判定 ===');
    console.log('P1: 現在', player1Score, '目標', player1Target, '残り', player1Remaining);
    console.log('P2: 現在', player2Score, '目標', player2Target, '残り', player2Remaining);
    console.log('ヒルヒル判定結果:', isHillHill);
    return isHillHill;
  };

  const swapPlayers = () => {
    setGameSettings(prev => ({
      ...prev,
      player1: prev.player2,
      player2: prev.player1
    }));
  };

  const swapTargets = () => {
    setGameSettings(prev => ({
      ...prev,
      player1Target: prev.player2Target,
      player2Target: prev.player1Target
    }));
  };

  const addNewPlayer = () => {
    if (newPlayerName.trim()) {
      const newId = Math.max(...players.map(p => p.id), 0) + 1;
      const newPlayer = {
        id: newId,
        name: newPlayerName,
        gamesPlayed: 0,
        gamesWon: 0,
        totalShots: 0,
        successfulShots: 0,
        massWari: 0,
        totalBallsPocketed: 0,
        totalInnings: 0,
        totalSafeties: 0,
        totalFouls: 0
      };
      setPlayers([...players, newPlayer]);
      setNewPlayerName('');
      setShowNewPlayerForm(false);
    }
  };

  const deletePlayer = (playerId) => {
    // プレイヤー1、プレイヤー2（ID: 1, 2）は削除不可
    if (playerId === 1 || playerId === 2) {
      alert('デフォルトプレイヤーは削除できません');
      return;
    }
    
    const player = players.find(p => p.id === playerId);
    if (window.confirm(`${player.name}を削除してもよろしいですか？\n戦績データも削除されます。`)) {
      setPlayers(players.filter(p => p.id !== playerId));
      
      // 削除したプレイヤーが選択されている場合はクリア
      if (gameSettings.player1?.id === playerId) {
        setGameSettings(prev => ({ ...prev, player1: null }));
      }
      if (gameSettings.player2?.id === playerId) {
        setGameSettings(prev => ({ ...prev, player2: null }));
      }
    }
  };

  const startGame = () => {
    if (gameSettings.player1 && gameSettings.player2) {
      const rule = getCurrentRule();
      const initialBalls = rule.getInitialBalls();
      
      // JCL9ボールの場合、ヒルヒル判定（簡単モードでは無効）
      const isHillHill = gameSettings.gameType === 'JCL9ボール' && gameSettings.operationMode === 'custom' ? 
        checkHillHill(0, 0, gameSettings.player1Target, gameSettings.player2Target) : false;
      
      // 開始時刻を記録
      const now = new Date();
      const startTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      setGameState({
        currentPlayer: 1,
        player1Score: 0,
        player2Score: 0,
        ballsOnTable: initialBalls,
        deadBalls: [],
        shotCount: 0,
        currentRackShots: 0,
        gameHistory: [],
        deadMode: false,
        player1Fouls: 0,
        player2Fouls: 0,
        actionHistory: [],
        currentRack: 1,
        currentInning: 1,
        shotInProgress: false,
        selectedBallsInShot: [],
        player1Stats: {
          totalBallsPocketed: 0,
          totalInnings: 0,
          massWari: 0,
          inningStats: [],
          shotsInGame: 0,  // ゲーム内のショット数を追加
          safetiesInGame: 0,  // ゲーム内のセーフティ数を追加
          foulsInGame: 0  // ゲーム内のファウル数を追加
        },
        player2Stats: {
          totalBallsPocketed: 0,
          totalInnings: 0,
          massWari: 0,
          inningStats: [],
          shotsInGame: 0,  // ゲーム内のショット数を追加
          safetiesInGame: 0,  // ゲーム内のセーフティ数を追加
          foulsInGame: 0  // ゲーム内のファウル数を追加
        },
        currentInningBalls: 0,
        isNewInning: true,
        currentInningPerfect: true,
        currentInningStartBalls: rule.ballCount,
        player1RackBalls: 0,
        player2RackBalls: 0,
        pocketedByPlayer: {},
        isHillHill: isHillHill,
        startTime: startTime,
        breakRule: gameSettings.operationMode === 'simple' ? 'alternate' : gameSettings.gameType === 'JPA9ボール' ? 'winner' : gameSettings.breakRule,
        threeFoulRule: gameSettings.operationMode === 'simple' ? false : gameSettings.gameType === 'JPA9ボール' ? false : gameSettings.threeFoulRule,
        lastRackWinner: null,
        // チェスクロック関連
        useChessClock: gameSettings.operationMode === 'simple' ? false : gameSettings.gameType === 'JPA9ボール' ? false : gameSettings.useChessClock,
        player1ChessTime: gameSettings.chessClockMinutes * 60,
        player2ChessTime: gameSettings.chessClockMinutes * 60,
        shotClockTime: gameSettings.shotClockSeconds,
        player1Extensions: 1, // エクステンション残り回数
        player2Extensions: 1, // エクステンション残り回数
        isClockPaused: false, // クロック一時停止
        player1IsUsingShootClock: false, // プレイヤー1のショットクロックモード
        player2IsUsingShootClock: false, // プレイヤー2のショットクロックモード
        clockStartTime: Date.now(), // クロック開始時刻
        operationMode: gameSettings.operationMode // 操作モード
      });
      setCurrentScreen('game');
    }
  };

  const undoLastAction = () => {
    if (gameState.actionHistory.length === 0) return;
    
    const lastAction = gameState.actionHistory[gameState.actionHistory.length - 1];
    const newActionHistory = gameState.actionHistory.slice(0, -1);
    
    // チェスクロック関連の現在の値を保持
    const currentClockValues = {
      player1ChessTime: gameState.player1ChessTime,
      player2ChessTime: gameState.player2ChessTime,
      shotClockTime: gameState.shotClockTime,
      player1IsUsingShootClock: gameState.player1IsUsingShootClock,
      player2IsUsingShootClock: gameState.player2IsUsingShootClock
    };
    
    setGameState({
      ...lastAction.previousState,
      ...currentClockValues, // チェスクロックの値は現在のものを維持
      actionHistory: newActionHistory
    });
  };

  // 簡単モード用のUNDO機能
  const undoSimpleMode = () => {
    if (gameState.actionHistory.length === 0) return;
    
    const lastAction = gameState.actionHistory[gameState.actionHistory.length - 1];
    const newActionHistory = gameState.actionHistory.slice(0, -1);
    
    setGameState({
      ...lastAction.previousState,
      actionHistory: newActionHistory
    });
  };

  const startShot = () => {
    const previousState = { ...gameState };
    delete previousState.actionHistory;
    
    const newState = {
      ...gameState,
      shotInProgress: true,
      selectedBallsInShot: [],
      actionHistory: [...gameState.actionHistory, {
        type: 'startShot',
        previousState
      }]
    };
    
    setGameState(newState);
  };

  const endShot = () => {
    const previousState = { ...gameState };
    delete previousState.actionHistory;
    
    if (gameState.selectedBallsInShot.length === 0) {
      // ボールが選択されていない場合はミスショット
      const newInning = Math.max(1, (gameState.currentPlayer === 2) ? gameState.currentInning + 1 : gameState.currentInning);
      
      // 現在のプレイヤーのショット数を増加
      const updatedPlayer1Stats = gameState.currentPlayer === 1 
        ? { ...gameState.player1Stats, shotsInGame: gameState.player1Stats.shotsInGame + 1 }
        : gameState.player1Stats;
      const updatedPlayer2Stats = gameState.currentPlayer === 2 
        ? { ...gameState.player2Stats, shotsInGame: gameState.player2Stats.shotsInGame + 1 }
        : gameState.player2Stats;
      
      const newState = {
        ...gameState,
        shotInProgress: false,
        selectedBallsInShot: [],
        currentPlayer: gameState.currentPlayer === 1 ? 2 : 1,
        shotCount: gameState.shotCount + 1,
        currentRackShots: gameState.currentRackShots + 1,
        currentInning: newInning,
        currentInningBalls: 0,
        isNewInning: true,
        currentInningPerfect: true,
        currentInningStartBalls: gameState.ballsOnTable.length,
        player1Stats: updatedPlayer1Stats,
        player2Stats: updatedPlayer2Stats,
        shotClockTime: gameSettings.shotClockSeconds, // ショットクロックをリセット
        actionHistory: [...gameState.actionHistory, {
          type: 'endShotMiss',
          previousState
        }]
      };
      
      setGameState(newState);
      return;
    }
    
    // 選択されたボールを全てポケット
    const newBallsOnTable = gameState.ballsOnTable.filter(ball => 
      !gameState.selectedBallsInShot.includes(ball)
    );
    
    // 統計を更新
    const ballsPoketedCount = gameState.selectedBallsInShot.length;
    const newCurrentInningBalls = gameState.currentInningBalls + ballsPoketedCount;
    const currentPlayerStats = gameState.currentPlayer === 1 ? gameState.player1Stats : gameState.player2Stats;
    let updatedPlayerStats = {
      ...currentPlayerStats,
      totalBallsPocketed: currentPlayerStats.totalBallsPocketed + ballsPoketedCount,
      shotsInGame: currentPlayerStats.shotsInGame + 1  // 現在のプレイヤーのショット数を増加
    };

    // マスワリ判定（9ボール、JPA9ボールの場合、ノーミスで1イニングで全ボール取り切った場合）
    const rule = getCurrentRule();
    if ((gameSettings.gameType === '9ボール' || gameSettings.gameType === 'JPA9ボール') && gameState.selectedBallsInShot.includes(9) && 
        gameState.currentInningPerfect && 
        gameState.currentInningStartBalls === 9 && 
        newCurrentInningBalls === 9) {
      updatedPlayerStats.massWari = currentPlayerStats.massWari + 1;
      alert(`🎉 マスワリ達成！ 🎉`);
    }
    
    // ファウルをクリア（ボールを落とした場合）
    const newPocketedByPlayer = { ...gameState.pocketedByPlayer };
    gameState.selectedBallsInShot.forEach(ball => {
      newPocketedByPlayer[ball] = gameState.currentPlayer;
    });
    
    // JCL9ボール用のラック内ボール数更新
    const newPlayer1RackBalls = gameState.currentPlayer === 1 ? 
      gameState.player1RackBalls + ballsPoketedCount : gameState.player1RackBalls;
    const newPlayer2RackBalls = gameState.currentPlayer === 2 ? 
      gameState.player2RackBalls + ballsPoketedCount : gameState.player2RackBalls;
    
    const newState = {
      ...gameState,
      shotInProgress: false,
      selectedBallsInShot: [],
      ballsOnTable: [...newBallsOnTable],
      shotCount: gameState.shotCount + 1,
      currentRackShots: gameState.currentRackShots + 1,
      currentInningBalls: newCurrentInningBalls,
      isNewInning: false,
      player1Fouls: gameState.currentPlayer === 1 ? 0 : gameState.player1Fouls,
      player2Fouls: gameState.currentPlayer === 2 ? 0 : gameState.player2Fouls,
      pocketedByPlayer: newPocketedByPlayer,
      player1RackBalls: newPlayer1RackBalls,
      player2RackBalls: newPlayer2RackBalls,
      shotClockTime: gameSettings.shotClockSeconds, // ショットクロックをリセット
      ...(gameState.currentPlayer === 1 ? { player1Stats: updatedPlayerStats } : { player2Stats: updatedPlayerStats }),
      actionHistory: [...gameState.actionHistory, {
        type: 'endShotSuccess',
        pocketedBalls: [...gameState.selectedBallsInShot],
        previousState
      }]
    };

    // ゲーム終了判定
    if (rule.checkGameEnd(gameState.selectedBallsInShot)) {
      // JCL9ボールで9番を落とした場合
      if (gameSettings.gameType === 'JCL9ボール') {
        const jclScore = rule.calculateJCLScore(gameState.currentPlayer, newPlayer1RackBalls, newPlayer2RackBalls);
        
        const updatedScore = {
          player1Score: gameState.player1Score + jclScore.player1Score,
          player2Score: gameState.player2Score + jclScore.player2Score
        };
        
        // ヒルヒル判定を再実行
        const newIsHillHill = checkHillHill(updatedScore.player1Score, updatedScore.player2Score, gameSettings.player1Target, gameSettings.player2Target);
        
        // 次のラックのブレイクプレイヤーを決定
        let nextBreakPlayer = gameState.currentPlayer;
        if (gameState.breakRule === 'alternate') {
          // 交互ブレイク: ラック番号が奇数ならP1、偶数ならP2
          nextBreakPlayer = ((gameState.currentRack + 1) % 2 === 1) ? 1 : 2;
        }
        
        // 交互ブレイクで後手から先手（P2→P1）への変更時のみイニング増加
        const newInning = (gameState.breakRule === 'alternate' && gameState.currentPlayer === 2 && nextBreakPlayer === 1) 
          ? gameState.currentInning + 1 
          : gameState.currentInning;
        
        const finalState = {
          ...newState,
          ...updatedScore,
          ballsOnTable: rule.getInitialBalls(),
          deadBalls: [],
          currentRackShots: 0,
          currentRack: gameState.currentRack + 1,
          currentInning: newInning,
          currentInningBalls: 0,
          isNewInning: true,
          currentInningPerfect: true,
          currentInningStartBalls: rule.ballCount,
          shotInProgress: false,
          selectedBallsInShot: [],
          pocketedByPlayer: {},
          player1RackBalls: 0,
          player2RackBalls: 0,
          isHillHill: newIsHillHill,
          currentPlayer: nextBreakPlayer,
          lastRackWinner: gameState.currentPlayer,
          player1Fouls: 0,  // ファウル数をリセット
          player2Fouls: 0,   // ファウル数をリセット
          player1Stats: gameState.currentPlayer === 1 ? updatedPlayerStats : {...gameState.player1Stats, safetiesInGame: gameState.player1Stats.safetiesInGame || 0, foulsInGame: gameState.player1Stats.foulsInGame || 0},
          player2Stats: gameState.currentPlayer === 2 ? updatedPlayerStats : {...gameState.player2Stats, safetiesInGame: gameState.player2Stats.safetiesInGame || 0, foulsInGame: gameState.player2Stats.foulsInGame || 0},
          shotClockTime: gameSettings.shotClockSeconds, // ショットクロックをリセット
          player1Extensions: 1, // エクステンションをリセット
          player2Extensions: 1  // エクステンションをリセット
        };
        
        setGameState(finalState);
        
        const message = rule.getRackEndMessage(gameState.currentPlayer, gameSettings, jclScore.winner9Points, jclScore.opponentPoints);
        if (message) alert(message);

        // ゲーム終了チェック
        // ヒルヒル状態かつ目標点数に到達した場合
        if (newIsHillHill && (updatedScore.player1Score >= gameSettings.player1Target || 
            updatedScore.player2Score >= gameSettings.player2Target)) {
          const winner = gameState.currentPlayer === 1 ? gameSettings.player1.name : gameSettings.player2.name;
          const winnerId = gameState.currentPlayer === 1 ? gameSettings.player1.id : gameSettings.player2.id;
          const loserId = gameState.currentPlayer === 1 ? gameSettings.player2.id : gameSettings.player1.id;
          
          // 戦績を更新
          updatePlayerStats(gameState.player1Stats, gameState.player2Stats, winnerId, loserId, gameState.currentInning);
          
          // 試合結果データを設定（勝利直前の状態を保存）
          setGameResult({
            winner: gameState.currentPlayer === 1 ? gameSettings.player1 : gameSettings.player2,
            loser: gameState.currentPlayer === 1 ? gameSettings.player2 : gameSettings.player1,
            finalScore: {
              player1: updatedScore.player1Score,
              player2: updatedScore.player2Score
            },
            gameType: gameSettings.gameType,
            totalShots: gameState.shotCount,
            totalRacks: gameState.currentRack,
            totalInnings: gameState.currentInning,
            player1Stats: gameState.player1Stats,
            player2Stats: gameState.player2Stats,
            gameState: gameState, // 勝利前の状態を保存
            winCondition: 'ヒルヒル'
          });
          
          setCurrentScreen('gameResult');
        }
        // 通常の目標点数到達による勝利（ヒルヒルでない場合）
        else if (!newIsHillHill && (updatedScore.player1Score >= gameSettings.player1Target || 
            updatedScore.player2Score >= gameSettings.player2Target)) {
          const winner = gameState.currentPlayer === 1 ? gameSettings.player1.name : gameSettings.player2.name;
          const winnerId = gameState.currentPlayer === 1 ? gameSettings.player1.id : gameSettings.player2.id;
          const loserId = gameState.currentPlayer === 1 ? gameSettings.player2.id : gameSettings.player1.id;
          
          // 戦績を更新
          updatePlayerStats(gameState.player1Stats, gameState.player2Stats, winnerId, loserId, gameState.currentInning);
          
          // 試合結果データを設定（勝利直前の状態を保存）
          setGameResult({
            winner: gameState.currentPlayer === 1 ? gameSettings.player1 : gameSettings.player2,
            loser: gameState.currentPlayer === 1 ? gameSettings.player2 : gameSettings.player1,
            finalScore: {
              player1: updatedScore.player1Score,
              player2: updatedScore.player2Score
            },
            gameType: gameSettings.gameType,
            totalShots: gameState.shotCount,
            totalRacks: gameState.currentRack,
            totalInnings: gameState.currentInning,
            player1Stats: gameState.player1Stats,
            player2Stats: gameState.player2Stats,
            gameState: gameState // 勝利前の状態を保存
          });
          
          setCurrentScreen('gameResult');
        }
      } else {
        // 通常の9ボール処理
        const updatedScore = gameState.currentPlayer === 1 ? 
          { ...newState, player1Score: rule.calculateScore(gameState.player1Score, gameState.selectedBallsInShot, gameState.currentPlayer, gameState) } :
          { ...newState, player2Score: rule.calculateScore(gameState.player2Score, gameState.selectedBallsInShot, gameState.currentPlayer, gameState) };
        
        // 次のラックのブレイクプレイヤーを決定
        let nextBreakPlayer = gameState.currentPlayer;
        if (gameState.breakRule === 'alternate') {
          // 交互ブレイク: ラック番号が奇数ならP1、偶数ならP2
          nextBreakPlayer = ((gameState.currentRack + 1) % 2 === 1) ? 1 : 2;
        }
        
        // 交互ブレイクで後手から先手（P2→P1）への変更時のみイニング増加
        const newInning = (gameState.breakRule === 'alternate' && gameState.currentPlayer === 2 && nextBreakPlayer === 1) 
          ? gameState.currentInning + 1 
          : gameState.currentInning;
        
        const finalState = {
          ...updatedScore,
          ballsOnTable: rule.getInitialBalls(),
          deadBalls: [],
          currentRackShots: 0,
          currentRack: gameState.currentRack + 1,
          currentInning: newInning,
          currentInningBalls: 0,
          isNewInning: true,
          currentInningPerfect: true,
          currentInningStartBalls: rule.ballCount,
          shotInProgress: false,
          selectedBallsInShot: [],
          pocketedByPlayer: {},
          player1Stats: gameState.currentPlayer === 1 ? updatedPlayerStats : gameState.player1Stats,
          player2Stats: gameState.currentPlayer === 2 ? updatedPlayerStats : gameState.player2Stats,
          currentPlayer: nextBreakPlayer,
          lastRackWinner: gameState.currentPlayer,
          player1Fouls: 0,  // ファウル数をリセット
          player2Fouls: 0   // ファウル数をリセット
        };
        
        setGameState(finalState);

        // ゲーム終了チェック
        if (updatedScore.player1Score >= gameSettings.player1Target || 
            updatedScore.player2Score >= gameSettings.player2Target) {
          const winner = gameState.currentPlayer === 1 ? gameSettings.player1.name : gameSettings.player2.name;
          const winnerId = gameState.currentPlayer === 1 ? gameSettings.player1.id : gameSettings.player2.id;
          const loserId = gameState.currentPlayer === 1 ? gameSettings.player2.id : gameSettings.player1.id;
          
          // 戦績を更新
          updatePlayerStats(gameState.player1Stats, gameState.player2Stats, winnerId, loserId, gameState.currentInning);
          
          // 試合結果データを設定（勝利直前の状態を保存）
          setGameResult({
            winner: gameState.currentPlayer === 1 ? gameSettings.player1 : gameSettings.player2,
            loser: gameState.currentPlayer === 1 ? gameSettings.player2 : gameSettings.player1,
            finalScore: {
              player1: updatedScore.player1Score,
              player2: updatedScore.player2Score
            },
            gameType: gameSettings.gameType,
            totalShots: gameState.shotCount,
            totalRacks: gameState.currentRack,
            totalInnings: gameState.currentInning,
            player1Stats: gameState.player1Stats,
            player2Stats: gameState.player2Stats,
            gameState: gameState // 勝利前の状態を保存
          });
          
          setCurrentScreen('gameResult');
        }
      }
    } else if (gameSettings.gameType === 'JPA9ボール') {
      // JPA9ボールの得点計算
      const updatedScore = gameState.currentPlayer === 1 ? 
        { ...newState, player1Score: rule.calculateScore(gameState.player1Score, gameState.selectedBallsInShot, gameState.currentPlayer, gameState) } :
        { ...newState, player2Score: rule.calculateScore(gameState.player2Score, gameState.selectedBallsInShot, gameState.currentPlayer, gameState) };
      
      setGameState(updatedScore);
      
      // ゲーム終了チェック
      if (updatedScore.player1Score >= gameSettings.player1Target || 
          updatedScore.player2Score >= gameSettings.player2Target) {
        const winner = updatedScore.player1Score >= gameSettings.player1Target ? gameSettings.player1 : gameSettings.player2;
        const loser = updatedScore.player1Score >= gameSettings.player1Target ? gameSettings.player2 : gameSettings.player1;
        const winnerId = winner.id;
        const loserId = loser.id;
        
        // 戦績を更新
        updatePlayerStats(updatedScore.player1Stats, updatedScore.player2Stats, winnerId, loserId, gameState.currentInning);
        
        // 試合結果データを設定
        setGameResult({
          winner: winner,
          loser: loser,
          finalScore: {
            player1: updatedScore.player1Score,
            player2: updatedScore.player2Score
          },
          gameType: gameSettings.gameType,
          totalShots: gameState.shotCount + 1,
          totalRacks: gameState.currentRack,
          totalInnings: gameState.currentInning,
          player1Stats: updatedScore.player1Stats,
          player2Stats: updatedScore.player2Stats,
          gameState: gameState
        });
        
        setCurrentScreen('gameResult');
      }
    } else {
      setGameState(newState);
    }
  };

  const endShotNew = () => {
    if (gameState.selectedBallsInShot.length === 0) {
      return;
    }
    
    // 選択されたボールを削除
    const newBalls = gameState.ballsOnTable.filter(b => 
      !gameState.selectedBallsInShot.includes(b)
    );
    
    // 統計を更新
    const ballsPoketedCount = gameState.selectedBallsInShot.length;
    const newCurrentInningBalls = (gameState.currentInningBalls || 0) + ballsPoketedCount;
    
    // プレイヤー統計
    const currentPlayerStats = gameState.currentPlayer === 1 ? gameState.player1Stats : gameState.player2Stats;
    const updatedPlayerStats = {
      ...currentPlayerStats,
      totalBallsPocketed: currentPlayerStats.totalBallsPocketed + ballsPoketedCount,
      shotsInGame: currentPlayerStats.shotsInGame + 1  // 現在のプレイヤーのショット数を増加
    };
    
    // ポケットしたボールの記録
    const newPocketedByPlayer = { ...gameState.pocketedByPlayer };
    gameState.selectedBallsInShot.forEach(ball => {
      newPocketedByPlayer[ball] = gameState.currentPlayer;
    });
    
    // JCL9ボール用のラック内ボール数更新
    const newPlayer1RackBalls = gameState.currentPlayer === 1 ? 
      (gameState.player1RackBalls || 0) + ballsPoketedCount : (gameState.player1RackBalls || 0);
    const newPlayer2RackBalls = gameState.currentPlayer === 2 ? 
      (gameState.player2RackBalls || 0) + ballsPoketedCount : (gameState.player2RackBalls || 0);
    
    // 基本的な新しい状態
    const newState = {
      ...gameState,
      shotInProgress: false,
      selectedBallsInShot: [],
      ballsOnTable: newBalls,
      shotCount: gameState.shotCount + 1,
      currentRackShots: (gameState.currentRackShots || 0) + 1,
      currentInningBalls: newCurrentInningBalls,
      isNewInning: false,
      player1RackBalls: newPlayer1RackBalls,
      player2RackBalls: newPlayer2RackBalls,
      pocketedByPlayer: newPocketedByPlayer,
      shotClockTime: gameSettings.shotClockSeconds, // ショットクロックをリセット
      ...(gameState.currentPlayer === 1 ? { player1Stats: updatedPlayerStats } : { player2Stats: updatedPlayerStats })
    };
    
    const rule = getCurrentRule();
    
    // ゲーム終了判定
    if (rule.checkGameEnd(gameState.selectedBallsInShot)) {
      // JCL9ボールで9番を落とした場合
      if (gameSettings.gameType === 'JCL9ボール') {
        const jclScore = rule.calculateJCLScore(gameState.currentPlayer, newPlayer1RackBalls, newPlayer2RackBalls);
        
        const newScore = {
          player1Score: gameState.player1Score + jclScore.player1Score,
          player2Score: gameState.player2Score + jclScore.player2Score
        };
        
        // ヒルヒル判定を再実行
        const newIsHillHill = checkHillHill(newScore.player1Score, newScore.player2Score, gameSettings.player1Target, gameSettings.player2Target);
        
        // 次のラックのブレイクプレイヤーを決定
        let nextBreakPlayer = gameState.currentPlayer;
        if (gameState.breakRule === 'alternate') {
          // 交互ブレイク: ラック番号が奇数ならP1、偶数ならP2
          nextBreakPlayer = ((gameState.currentRack + 1) % 2 === 1) ? 1 : 2;
        }
        
        // 交互ブレイクで後手から先手（P2→P1）への変更時のみイニング増加
        const newInning = (gameState.breakRule === 'alternate' && gameState.currentPlayer === 2 && nextBreakPlayer === 1) 
          ? gameState.currentInning + 1 
          : gameState.currentInning;
        
        // ラックをリセット
        const finalState = {
          ...newState,
          ...newScore,
          ballsOnTable: rule.getInitialBalls(),
          deadBalls: [],
          currentRackShots: 0,
          currentRack: gameState.currentRack + 1,
          currentInning: newInning, // 交互ブレイクのイニング処理
          currentInningBalls: 0,
          isNewInning: true,
          currentInningPerfect: true,
          currentInningStartBalls: rule.ballCount,
          shotInProgress: false,
          selectedBallsInShot: [],
          pocketedByPlayer: {},
          player1RackBalls: 0,
          player2RackBalls: 0,
          player1Stats: gameState.currentPlayer === 1 ? updatedPlayerStats : gameState.player1Stats,
          player2Stats: gameState.currentPlayer === 2 ? updatedPlayerStats : gameState.player2Stats,
          isHillHill: newIsHillHill,
          currentPlayer: nextBreakPlayer,
          lastRackWinner: gameState.currentPlayer,
          player1Fouls: 0,  // ファウル数をリセット
          player2Fouls: 0   // ファウル数をリセット
        };
        
        setGameState(finalState);
        
        const message = rule.getRackEndMessage(gameState.currentPlayer, gameSettings, jclScore.winner9Points, jclScore.opponentPoints);
        if (message) alert(message);
        
        // ゲーム終了チェック
        // ヒルヒル状態かつ目標点数に到達した場合
        if (newIsHillHill && (newScore.player1Score >= gameSettings.player1Target || 
            newScore.player2Score >= gameSettings.player2Target)) {
          const winner = gameState.currentPlayer === 1 ? gameSettings.player1 : gameSettings.player2;
          const loser = gameState.currentPlayer === 1 ? gameSettings.player2 : gameSettings.player1;
          const winnerId = gameState.currentPlayer === 1 ? gameSettings.player1.id : gameSettings.player2.id;
          const loserId = gameState.currentPlayer === 1 ? gameSettings.player2.id : gameSettings.player1.id;
          
          // 戦績を更新
          updatePlayerStats(updatedPlayerStats, gameState.currentPlayer === 1 ? gameState.player2Stats : gameState.player1Stats, winnerId, loserId, gameState.currentInning);
          
          // 試合結果データを設定（勝利直前の状態を保存）
          setGameResult({
            winner: winner,
            loser: loser,
            finalScore: {
              player1: newScore.player1Score,
              player2: newScore.player2Score
            },
            gameType: gameSettings.gameType,
            totalShots: gameState.shotCount,
            totalRacks: gameState.currentRack,
            totalInnings: gameState.currentInning,
            player1Stats: gameState.currentPlayer === 1 ? updatedPlayerStats : gameState.player1Stats,
            player2Stats: gameState.currentPlayer === 2 ? updatedPlayerStats : gameState.player2Stats,
            gameState: gameState, // 勝利前の状態を保存
            winCondition: 'ヒルヒル'
          });
          
          setCurrentScreen('gameResult');
          return;
        }
        // 通常の目標点数到達による勝利（ヒルヒルでない場合）
        else if (!newIsHillHill && (newScore.player1Score >= gameSettings.player1Target || 
            newScore.player2Score >= gameSettings.player2Target)) {
          const winner = newScore.player1Score >= gameSettings.player1Target ? gameSettings.player1 : gameSettings.player2;
          const loser = newScore.player1Score >= gameSettings.player1Target ? gameSettings.player2 : gameSettings.player1;
          const winnerId = newScore.player1Score >= gameSettings.player1Target ? gameSettings.player1.id : gameSettings.player2.id;
          const loserId = newScore.player1Score >= gameSettings.player1Target ? gameSettings.player2.id : gameSettings.player1.id;
          
          // 戦績を更新
          updatePlayerStats(gameState.currentPlayer === 1 ? updatedPlayerStats : gameState.player1Stats, 
                          gameState.currentPlayer === 2 ? updatedPlayerStats : gameState.player2Stats, 
                          winnerId, loserId, gameState.currentInning);
          
          // 試合結果データを設定（勝利直前の状態を保存）
          setGameResult({
            winner: winner,
            loser: loser,
            finalScore: {
              player1: newScore.player1Score,
              player2: newScore.player2Score
            },
            gameType: gameSettings.gameType,
            totalShots: gameState.shotCount,
            totalRacks: gameState.currentRack,
            totalInnings: gameState.currentInning,
            player1Stats: gameState.currentPlayer === 1 ? updatedPlayerStats : gameState.player1Stats,
            player2Stats: gameState.currentPlayer === 2 ? updatedPlayerStats : gameState.player2Stats,
            gameState: gameState // 勝利前の状態を保存
          });
          
          setCurrentScreen('gameResult');
        }
      } 
      // 通常の9ボールで9番を落とした場合
      else if (gameSettings.gameType === '9ボール') {
        const updatedScore = gameState.currentPlayer === 1 ? 
          { ...newState, player1Score: gameState.player1Score + 1 } :
          { ...newState, player2Score: gameState.player2Score + 1 };
        
        // 次のラックのブレイクプレイヤーを決定
        let nextBreakPlayer = gameState.currentPlayer;
        if (gameState.breakRule === 'alternate') {
          // 交互ブレイク: ラック番号が奇数ならP1、偶数ならP2
          nextBreakPlayer = ((gameState.currentRack + 1) % 2 === 1) ? 1 : 2;
        }
        
        // 交互ブレイクでプレイヤーが変わる場合、イニングを増加
        const newInning = (gameState.breakRule === 'alternate' && nextBreakPlayer !== gameState.currentPlayer) 
          ? gameState.currentInning + 1 
          : gameState.currentInning;
        
        // ラックをリセット
        const finalState = {
          ...updatedScore,
          ballsOnTable: rule.getInitialBalls(),
          deadBalls: [],
          currentRackShots: 0,
          currentRack: gameState.currentRack + 1,
          currentInning: newInning, // 交互ブレイクのイニング処理
          currentInningBalls: 0,
          isNewInning: true,
          pocketedByPlayer: {},
          currentPlayer: nextBreakPlayer,
          lastRackWinner: gameState.currentPlayer,
          player1Fouls: 0,  // ファウル数をリセット
          player2Fouls: 0   // ファウル数をリセット
        };
        
        setGameState(finalState);
      }
    }
    // JPA9ボールの場合
    else if (gameSettings.gameType === 'JPA9ボール') {
      // JPA9ボールの得点計算
      const updatedScore = gameState.currentPlayer === 1 ? 
        { ...newState, player1Score: rule.calculateScore(gameState.player1Score, gameState.selectedBallsInShot, gameState.currentPlayer, gameState) } :
        { ...newState, player2Score: rule.calculateScore(gameState.player2Score, gameState.selectedBallsInShot, gameState.currentPlayer, gameState) };
      
      // 9番を落とした場合、ラックをリセット
      if (gameState.selectedBallsInShot.includes(9)) {
        const finalState = {
          ...updatedScore,
          ballsOnTable: rule.getInitialBalls(),
          deadBalls: [],
          currentRackShots: 0,
          currentRack: gameState.currentRack + 1,
          currentInningBalls: 0,
          isNewInning: false,
          pocketedByPlayer: {},
          currentPlayer: gameState.currentPlayer, // 勝者ブレイク
          lastRackWinner: gameState.currentPlayer,
          player1Fouls: 0,
          player2Fouls: 0
        };
        
        setGameState(finalState);
        
        // ゲーム終了チェック
        if (updatedScore.player1Score >= gameSettings.player1Target || 
            updatedScore.player2Score >= gameSettings.player2Target) {
          const winner = updatedScore.player1Score >= gameSettings.player1Target ? gameSettings.player1 : gameSettings.player2;
          const loser = updatedScore.player1Score >= gameSettings.player1Target ? gameSettings.player2 : gameSettings.player1;
          const winnerId = winner.id;
          const loserId = loser.id;
          
          // 戦績を更新
          updatePlayerStats(updatedScore.player1Stats, updatedScore.player2Stats, winnerId, loserId, gameState.currentInning);
          
          // 試合結果データを設定
          setGameResult({
            winner: winner,
            loser: loser,
            finalScore: {
              player1: updatedScore.player1Score,
              player2: updatedScore.player2Score
            },
            gameType: gameSettings.gameType,
            totalShots: updatedScore.shotCount,
            totalRacks: gameState.currentRack,
            totalInnings: gameState.currentInning,
            player1Stats: updatedScore.player1Stats,
            player2Stats: updatedScore.player2Stats,
            gameState: gameState
          });
          
          setCurrentScreen('gameResult');
        }
      } else {
        setGameState(updatedScore);
      }
    }
    // 通常のショット
    else {
      setGameState(newState);
    }
  };

  const toggleShotMode = () => {
    if (gameState.shotInProgress) {
      endShotNew();
    } else {
      startShot();
    }
  };

  const toggleDeadMode = () => {
    const previousState = { ...gameState };
    delete previousState.actionHistory;
    
    const newState = {
      ...gameState,
      deadMode: !gameState.deadMode,
      actionHistory: [...gameState.actionHistory, {
        type: 'toggleDeadMode',
        previousState
      }]
    };
    
    setGameState(newState);
  };

  const pocketBall = (ballNumber) => {
    console.log('=== pocketBall 呼び出し ===');
    console.log('ballNumber:', ballNumber);
    console.log('gameType:', gameSettings.gameType);
    console.log('deadMode:', gameState.deadMode);
    console.log('shotInProgress:', gameState.shotInProgress);
    
    const previousState = { ...gameState };
    delete previousState.actionHistory;
    const rule = getCurrentRule();
    
    if (gameState.deadMode) {
      // 無効級モード
      // 9ボール、JPA9ボール、JCL9ボールでは9番を無効球にできない
      if ((gameSettings.gameType === '9ボール' || gameSettings.gameType === 'JPA9ボール' || gameSettings.gameType === 'JCL9ボール') && ballNumber === 9) {
        alert('9番ボールは無効球にできません');
        return;
      }
      
      if (gameState.ballsOnTable.includes(ballNumber) && !gameState.deadBalls.includes(ballNumber)) {
        const newDeadBalls = [...gameState.deadBalls, ballNumber];
        
        const newState = {
          ...gameState,
          deadBalls: newDeadBalls,
          // deadMode: false を削除し、複数選択可能にする
          actionHistory: [...gameState.actionHistory, {
            type: 'deadBall',
            ballNumber,
            previousState
          }]
        };
        
        setGameState(newState);
      } else if (gameState.deadBalls.includes(ballNumber)) {
        // 無効級を解除
        const newDeadBalls = gameState.deadBalls.filter(ball => ball !== ballNumber);
        
        const newState = {
          ...gameState,
          deadBalls: newDeadBalls,
          // deadMode: false を削除し、複数選択可能にする
          actionHistory: [...gameState.actionHistory, {
            type: 'undeadBall',
            ballNumber,
            previousState
          }]
        };
        
        setGameState(newState);
      }
    } else if (gameState.shotInProgress) {
      // ショット中 - ボールを選択/選択解除
      if (gameState.ballsOnTable.includes(ballNumber)) {
        const isSelected = gameState.selectedBallsInShot.includes(ballNumber);
        const newSelectedBalls = isSelected 
          ? gameState.selectedBallsInShot.filter(ball => ball !== ballNumber)
          : [...gameState.selectedBallsInShot, ballNumber];
        
        const newState = {
          ...gameState,
          selectedBallsInShot: newSelectedBalls,
          actionHistory: [...gameState.actionHistory, {
            type: 'selectBall',
            ballNumber,
            isSelected: !isSelected,
            previousState
          }]
        };
        
        setGameState(newState);
      }
    } else {
      // 従来のポケットモード（テーブルから削除のみ、戻すことはできない）
      if (gameState.ballsOnTable.includes(ballNumber)) {
        const newBallsOnTable = gameState.ballsOnTable.filter(ball => ball !== ballNumber);
        
        // 統計を更新（ボール数のみ、イニングは更新しない）
        const newCurrentInningBalls = gameState.currentInningBalls + 1;
        const currentPlayerStats = gameState.currentPlayer === 1 ? gameState.player1Stats : gameState.player2Stats;
        let updatedPlayerStats = {
          ...currentPlayerStats,
          totalBallsPocketed: currentPlayerStats.totalBallsPocketed + 1,
          shotsInGame: currentPlayerStats.shotsInGame + 1  // 現在のプレイヤーのショット数を増加
        };

        // JCL9ボール用のラック内ボール数更新
        const newPlayer1RackBalls = gameState.currentPlayer === 1 ? gameState.player1RackBalls + 1 : gameState.player1RackBalls;
        const newPlayer2RackBalls = gameState.currentPlayer === 2 ? gameState.player2RackBalls + 1 : gameState.player2RackBalls;

        // マスワリ判定（9ボール、JPA9ボール、またはJCL9ボールの場合、ノーミスで1イニングで全ボール取り切った場合）
        if ((gameSettings.gameType === '9ボール' || gameSettings.gameType === 'JPA9ボール' || gameSettings.gameType === 'JCL9ボール') && ballNumber === 9 && 
            gameState.currentInningPerfect && 
            gameState.currentInningStartBalls === 9 && 
            newCurrentInningBalls === 9) {
          updatedPlayerStats.massWari = currentPlayerStats.massWari + 1;
          alert(`🎉 マスワリ達成！ 🎉`);
        }
        
        // ファウルをクリア（ボールを落とした場合）
        const newPocketedByPlayer = {
          ...gameState.pocketedByPlayer,
          [ballNumber]: gameState.currentPlayer
        };
        
        const newState = {
          ...gameState,
          ballsOnTable: newBallsOnTable,
          shotCount: gameState.shotCount + 1,
          currentRackShots: gameState.currentRackShots + 1,
          currentInningBalls: newCurrentInningBalls,
          isNewInning: false,
          player1Fouls: gameState.currentPlayer === 1 ? 0 : gameState.player1Fouls,
          player2Fouls: gameState.currentPlayer === 2 ? 0 : gameState.player2Fouls,
          player1RackBalls: newPlayer1RackBalls,
          player2RackBalls: newPlayer2RackBalls,
          pocketedByPlayer: newPocketedByPlayer,
          ...(gameState.currentPlayer === 1 ? { player1Stats: updatedPlayerStats } : { player2Stats: updatedPlayerStats }),
          shotClockTime: gameSettings.shotClockSeconds, // ショットクロックをリセット
          actionHistory: [...gameState.actionHistory, {
            type: 'pocketBall',
            ballNumber,
            previousState
          }]
        };

        // ゲーム終了判定
        if (ballNumber === rule.endBall) {
          // JCL9ボールの場合は点数計算、それ以外は通常のラック獲得
          if (gameSettings.gameType === 'JCL9ボール') {
            // JCL9ボール終了時：統計を更新
            const finalPlayer1Stats = {
              ...gameState.player1Stats,
              totalBallsPocketed: gameState.currentPlayer === 1 ? updatedPlayerStats.totalBallsPocketed : gameState.player1Stats.totalBallsPocketed,
              totalInnings: gameState.player1Stats.totalInnings,  // 現在のイニング数を維持
              massWari: gameState.currentPlayer === 1 ? updatedPlayerStats.massWari : gameState.player1Stats.massWari,
              inningStats: gameState.player1Stats.inningStats,
              shotsInGame: gameState.currentPlayer === 1 ? updatedPlayerStats.shotsInGame : (gameState.player1Stats.shotsInGame || 0),
              safetiesInGame: gameState.player1Stats.safetiesInGame || 0,
              foulsInGame: gameState.player1Stats.foulsInGame || 0
            };
            
            const finalPlayer2Stats = {
              ...gameState.player2Stats,
              totalBallsPocketed: gameState.currentPlayer === 2 ? updatedPlayerStats.totalBallsPocketed : gameState.player2Stats.totalBallsPocketed,
              totalInnings: gameState.player2Stats.totalInnings,  // 現在のイニング数を維持
              massWari: gameState.currentPlayer === 2 ? updatedPlayerStats.massWari : gameState.player2Stats.massWari,
              inningStats: gameState.player2Stats.inningStats,
              shotsInGame: gameState.currentPlayer === 2 ? updatedPlayerStats.shotsInGame : (gameState.player2Stats.shotsInGame || 0),
              safetiesInGame: gameState.player2Stats.safetiesInGame || 0,
              foulsInGame: gameState.player2Stats.foulsInGame || 0
            };
            
            // JCL9ボールの得点計算
            const jclScore = rule.calculateJCLScore(gameState.currentPlayer, newPlayer1RackBalls, newPlayer2RackBalls);
            
            const newScore = {
              player1Score: gameState.player1Score + jclScore.player1Score,
              player2Score: gameState.player2Score + jclScore.player2Score
            };
            
            // ヒルヒル判定を再実行
            const newIsHillHill = checkHillHill(newScore.player1Score, newScore.player2Score, gameSettings.player1Target, gameSettings.player2Target);
            
            // 次のラックのブレイクプレイヤーを決定
            let nextBreakPlayer = gameState.currentPlayer;
            if (gameState.breakRule === 'alternate') {
              // 交互ブレイク: ラック番号が奇数ならP1、偶数ならP2
              nextBreakPlayer = ((gameState.currentRack + 1) % 2 === 1) ? 1 : 2;
            }
            
            // 交互ブレイクで後手から先手（P2→P1）への変更時のみイニング増加
            const newInning = (gameState.breakRule === 'alternate' && gameState.currentPlayer === 2 && nextBreakPlayer === 1) 
              ? gameState.currentInning + 1 
              : gameState.currentInning;
            
            const finalState = {
              ...newState,
              ...newScore,
              ballsOnTable: rule.getInitialBalls(),
              deadBalls: [],
              currentRackShots: 0,
              currentRack: gameState.currentRack + 1,
              currentInning: newInning, // 交互ブレイクのイニング処理
              currentInningBalls: 0,
              isNewInning: true,
              currentInningPerfect: true,
              currentInningStartBalls: rule.ballCount,
              shotInProgress: false,
              selectedBallsInShot: [],
              player1RackBalls: 0,
              player2RackBalls: 0,
              player1Stats: {
                ...finalPlayer1Stats,
                shotsInGame: finalPlayer1Stats.shotsInGame || 0,
                safetiesInGame: finalPlayer1Stats.safetiesInGame || 0,
                foulsInGame: finalPlayer1Stats.foulsInGame || 0
              },
              player2Stats: {
                ...finalPlayer2Stats,
                shotsInGame: finalPlayer2Stats.shotsInGame || 0,
                safetiesInGame: finalPlayer2Stats.safetiesInGame || 0,
                foulsInGame: finalPlayer2Stats.foulsInGame || 0
              },
              pocketedByPlayer: {},
              isHillHill: newIsHillHill,
              currentPlayer: nextBreakPlayer,
              lastRackWinner: gameState.currentPlayer,
              player1Fouls: 0,  // ファウル数をリセット
              player2Fouls: 0,   // ファウル数をリセット
              shotClockTime: gameSettings.shotClockSeconds, // ショットクロックをリセット
              player1Extensions: 1, // エクステンションをリセット
              player2Extensions: 1  // エクステンションをリセット
            };
            
            setGameState(finalState);
            
            // JCL9ボールゲーム終了チェック
            // ヒルヒル状態かつ目標点数に到達した場合
            if (newIsHillHill && (newScore.player1Score >= gameSettings.player1Target || 
                newScore.player2Score >= gameSettings.player2Target)) {
              const winner = gameState.currentPlayer === 1 ? gameSettings.player1 : gameSettings.player2;
              const loser = gameState.currentPlayer === 1 ? gameSettings.player2 : gameSettings.player1;
              const winnerId = gameState.currentPlayer === 1 ? gameSettings.player1.id : gameSettings.player2.id;
              const loserId = gameState.currentPlayer === 1 ? gameSettings.player2.id : gameSettings.player1.id;
              
              // 戦績を更新
              updatePlayerStats(finalPlayer1Stats, finalPlayer2Stats, winnerId, loserId, gameState.currentInning);
              
              // 試合結果データを設定（勝利直前の状態を保存）
              setGameResult({
                winner: winner,
                loser: loser,
                finalScore: {
                  player1: newScore.player1Score,
                  player2: newScore.player2Score
                },
                gameType: gameSettings.gameType,
                totalShots: gameState.shotCount + 1,
                totalRacks: gameState.currentRack,
                totalInnings: gameState.currentInning,
                player1Stats: finalPlayer1Stats,
                player2Stats: finalPlayer2Stats,
                gameState: gameState, // 勝利前の状態を保存
                winCondition: 'ヒルヒル'
              });
              
              setCurrentScreen('gameResult');
            } 
            // 通常の目標点数到達による勝利（ヒルヒルでない場合）
            else if (!newIsHillHill && (newScore.player1Score >= gameSettings.player1Target || 
                newScore.player2Score >= gameSettings.player2Target)) {
              const winner = newScore.player1Score >= gameSettings.player1Target ? gameSettings.player1 : gameSettings.player2;
              const loser = newScore.player1Score >= gameSettings.player1Target ? gameSettings.player2 : gameSettings.player1;
              const winnerId = newScore.player1Score >= gameSettings.player1Target ? gameSettings.player1.id : gameSettings.player2.id;
              const loserId = newScore.player1Score >= gameSettings.player1Target ? gameSettings.player2.id : gameSettings.player1.id;
              
              // 戦績を更新
              updatePlayerStats(finalPlayer1Stats, finalPlayer2Stats, winnerId, loserId, gameState.currentInning);
              
              // 試合結果データを設定（勝利直前の状態を保存）
              setGameResult({
                winner: winner,
                loser: loser,
                finalScore: {
                  player1: newScore.player1Score,
                  player2: newScore.player2Score
                },
                gameType: gameSettings.gameType,
                totalShots: gameState.shotCount + 1,
                totalRacks: gameState.currentRack,
                totalInnings: gameState.currentInning,
                player1Stats: finalPlayer1Stats,
                player2Stats: finalPlayer2Stats,
                gameState: gameState, // 勝利前の状態を保存
              });
              
              setCurrentScreen('gameResult');
            } else {
              const message = rule.getRackEndMessage(gameState.currentPlayer, gameSettings, jclScore.winner9Points, jclScore.opponentPoints);
              if (message) alert(message);
            }
          } else if (gameSettings.gameType === 'JPA9ボール') {
            // JPA9ボールの得点計算
            const updatedScore = gameState.currentPlayer === 1 ? 
              { ...newState, player1Score: rule.calculateScore(gameState.player1Score, [ballNumber], gameState.currentPlayer, gameState) } :
              { ...newState, player2Score: rule.calculateScore(gameState.player2Score, [ballNumber], gameState.currentPlayer, gameState) };
            
            // 9番を落とした場合、ラックをリセット
            if (ballNumber === 9) {
              const finalState = {
                ...updatedScore,
                ballsOnTable: rule.getInitialBalls(),
                deadBalls: [],
                currentRackShots: 0,
                currentRack: gameState.currentRack + 1,
                currentInningBalls: 0,
                isNewInning: false,
                currentInningPerfect: true,
                currentInningStartBalls: rule.ballCount,
                shotInProgress: false,
                selectedBallsInShot: [],
                pocketedByPlayer: {},
                currentPlayer: gameState.currentPlayer, // 勝者ブレイク
                lastRackWinner: gameState.currentPlayer,
                player1Fouls: 0,
                player2Fouls: 0,
                shotClockTime: gameSettings.shotClockSeconds
              };
              
              setGameState(finalState);
              
              // ゲーム終了チェック
              if (updatedScore.player1Score >= gameSettings.player1Target || 
                  updatedScore.player2Score >= gameSettings.player2Target) {
                const winner = updatedScore.player1Score >= gameSettings.player1Target ? gameSettings.player1 : gameSettings.player2;
                const loser = updatedScore.player1Score >= gameSettings.player1Target ? gameSettings.player2 : gameSettings.player1;
                const winnerId = winner.id;
                const loserId = loser.id;
                
                // 戦績を更新
                updatePlayerStats(updatedScore.player1Stats, updatedScore.player2Stats, winnerId, loserId, gameState.currentInning);
                
                // 試合結果データを設定
                setGameResult({
                  winner: winner,
                  loser: loser,
                  finalScore: {
                    player1: updatedScore.player1Score,
                    player2: updatedScore.player2Score
                  },
                  gameType: gameSettings.gameType,
                  totalShots: gameState.shotCount + 1,
                  totalRacks: gameState.currentRack,
                  totalInnings: gameState.currentInning,
                  player1Stats: updatedScore.player1Stats,
                  player2Stats: updatedScore.player2Stats,
                  gameState: gameState
                });
                
                setCurrentScreen('gameResult');
              }
            } else {
              setGameState(updatedScore);
            }
          } else {
            // 通常の9ボール・8ボール処理
            // ラック終了時に現在のイニングの統計を確実に更新
            let finalPlayer1Stats = updatedPlayerStats;
            let finalPlayer2Stats = gameState.player2Stats;
            
            if (gameState.currentPlayer === 1) {
              finalPlayer1Stats = {
                ...updatedPlayerStats,
                totalInnings: updatedPlayerStats.totalInnings + 1,
                inningStats: [...updatedPlayerStats.inningStats, newCurrentInningBalls],
                shotsInGame: updatedPlayerStats.shotsInGame,
                safetiesInGame: updatedPlayerStats.safetiesInGame || 0,
                foulsInGame: updatedPlayerStats.foulsInGame || 0
              };
              finalPlayer2Stats = {
                ...gameState.player2Stats,
                shotsInGame: gameState.player2Stats.shotsInGame,
                safetiesInGame: gameState.player2Stats.safetiesInGame || 0,
                foulsInGame: gameState.player2Stats.foulsInGame || 0
              };
            } else {
              finalPlayer2Stats = {
                ...updatedPlayerStats,
                totalInnings: updatedPlayerStats.totalInnings + 1,
                inningStats: [...updatedPlayerStats.inningStats, newCurrentInningBalls],
                shotsInGame: updatedPlayerStats.shotsInGame,
                safetiesInGame: updatedPlayerStats.safetiesInGame || 0,
                foulsInGame: updatedPlayerStats.foulsInGame || 0
              };
              finalPlayer1Stats = {
                ...gameState.player1Stats,
                shotsInGame: gameState.player1Stats.shotsInGame,
                safetiesInGame: gameState.player1Stats.safetiesInGame || 0,
                foulsInGame: gameState.player1Stats.foulsInGame || 0
              };
            }
            
            const updatedScore = gameState.currentPlayer === 1 ? 
              { ...newState, player1Score: rule.calculateScore(gameState.player1Score, [ballNumber], gameState.currentPlayer, gameState) } :
              { ...newState, player2Score: rule.calculateScore(gameState.player2Score, [ballNumber], gameState.currentPlayer, gameState) };
            
            // 次のラックのブレイクプレイヤーを決定
            let nextBreakPlayer = gameState.currentPlayer;
            if (gameState.breakRule === 'alternate') {
              // 交互ブレイク: ラック番号が奇数ならP1、偶数ならP2
              nextBreakPlayer = ((gameState.currentRack + 1) % 2 === 1) ? 1 : 2;
            }
            
            // 交互ブレイクで後手から先手（P2→P1）への変更時のみイニング増加
            const newInning = (gameState.breakRule === 'alternate' && gameState.currentPlayer === 2 && nextBreakPlayer === 1) 
              ? gameState.currentInning + 1 
              : gameState.currentInning;
            
            const finalState = {
              ...updatedScore,
              ballsOnTable: rule.getInitialBalls(),
              deadBalls: [],
              currentRackShots: 0,
              currentRack: gameState.currentRack + 1,
              currentInning: newInning, // 交互ブレイクのイニング処理
              currentInningBalls: 0,
              isNewInning: true,
              currentInningPerfect: true,
              currentInningStartBalls: rule.ballCount,
              shotInProgress: false,
              selectedBallsInShot: [],
              player1Stats: {
                ...finalPlayer1Stats,
                shotsInGame: finalPlayer1Stats.shotsInGame || 0,
                safetiesInGame: finalPlayer1Stats.safetiesInGame || 0,
                foulsInGame: finalPlayer1Stats.foulsInGame || 0
              },
              player2Stats: {
                ...finalPlayer2Stats,  
                shotsInGame: finalPlayer2Stats.shotsInGame || 0,
                safetiesInGame: finalPlayer2Stats.safetiesInGame || 0,
                foulsInGame: finalPlayer2Stats.foulsInGame || 0
              },
              player1RackBalls: 0,
              player2RackBalls: 0,
              pocketedByPlayer: {},
              currentPlayer: nextBreakPlayer,
              lastRackWinner: gameState.currentPlayer,
              player1Fouls: 0,  // ファウル数をリセット
              player2Fouls: 0,   // ファウル数をリセット
              shotClockTime: gameSettings.shotClockSeconds, // ショットクロックをリセット
              player1Extensions: 1, // エクステンションをリセット
              player2Extensions: 1  // エクステンションをリセット
            };
            
            setGameState(finalState);

            // 通常のゲーム終了チェック
            if (updatedScore.player1Score >= gameSettings.player1Target || 
                updatedScore.player2Score >= gameSettings.player2Target) {
              const winner = gameState.currentPlayer === 1 ? gameSettings.player1 : gameSettings.player2;
              const loser = gameState.currentPlayer === 1 ? gameSettings.player2 : gameSettings.player1;
              const winnerId = gameState.currentPlayer === 1 ? gameSettings.player1.id : gameSettings.player2.id;
              const loserId = gameState.currentPlayer === 1 ? gameSettings.player2.id : gameSettings.player1.id;
              
              // 戦績を更新
              updatePlayerStats(finalPlayer1Stats, finalPlayer2Stats, winnerId, loserId, gameState.currentInning);
              
              // 試合結果データを設定（勝利直前の状態を保存）
              setGameResult({
                winner: winner,
                loser: loser,
                finalScore: {
                  player1: updatedScore.player1Score,
                  player2: updatedScore.player2Score
                },
                gameType: gameSettings.gameType,
                totalShots: gameState.shotCount + 1,
                totalRacks: gameState.currentRack,
                totalInnings: gameState.currentInning,
                player1Stats: finalPlayer1Stats,
                player2Stats: finalPlayer2Stats,
                gameState: gameState // 勝利前の状態を保存
              });
              
              setCurrentScreen('gameResult');
            }
          }
        } else {
          // JPA9ボールの場合の得点計算
          if (gameSettings.gameType === 'JPA9ボール') {
            const updatedScore = gameState.currentPlayer === 1 ? 
              { ...newState, player1Score: rule.calculateScore(gameState.player1Score, [ballNumber], gameState.currentPlayer, gameState) } :
              { ...newState, player2Score: rule.calculateScore(gameState.player2Score, [ballNumber], gameState.currentPlayer, gameState) };
            
            setGameState(updatedScore);
            
            // ゲーム終了チェック
            if (updatedScore.player1Score >= gameSettings.player1Target || 
                updatedScore.player2Score >= gameSettings.player2Target) {
              const winner = updatedScore.player1Score >= gameSettings.player1Target ? gameSettings.player1 : gameSettings.player2;
              const loser = updatedScore.player1Score >= gameSettings.player1Target ? gameSettings.player2 : gameSettings.player1;
              const winnerId = winner.id;
              const loserId = loser.id;
              
              // 戦績を更新
              updatePlayerStats(updatedScore.player1Stats, updatedScore.player2Stats, winnerId, loserId, gameState.currentInning);
              
              // 試合結果データを設定
              setGameResult({
                winner: winner,
                loser: loser,
                finalScore: {
                  player1: updatedScore.player1Score,
                  player2: updatedScore.player2Score
                },
                gameType: gameSettings.gameType,
                totalShots: gameState.shotCount + 1,
                totalRacks: gameState.currentRack,
                totalInnings: gameState.currentInning,
                player1Stats: updatedScore.player1Stats,
                player2Stats: updatedScore.player2Stats,
                gameState: gameState
              });
              
              setCurrentScreen('gameResult');
            }
          } else {
            setGameState(newState);
          }
        }
      }
    }
  };

  const switchPlayer = () => {
    const previousState = { ...gameState };
    delete previousState.actionHistory;
    
    // プレイヤー交代時、プレイヤー1に戻る場合はイニング+1
    const newInning = Math.max(1, (gameState.currentPlayer === 2) ? gameState.currentInning + 1 : gameState.currentInning);
    
    // 現在のイニングを終了（直接統計を更新）
    let updatedPlayer1Stats = gameState.player1Stats;
    let updatedPlayer2Stats = gameState.player2Stats;
    
    // ショット数を増加（現在のプレイヤーがショットをしたとみなす）
    if (gameState.currentPlayer === 1) {
      updatedPlayer1Stats = {
        ...gameState.player1Stats,
        shotsInGame: gameState.player1Stats.shotsInGame + 1
      };
    } else {
      updatedPlayer2Stats = {
        ...gameState.player2Stats,
        shotsInGame: gameState.player2Stats.shotsInGame + 1
      };
    }
    
    if (!gameState.isNewInning) {
      if (gameState.currentPlayer === 1) {
        updatedPlayer1Stats = {
          ...updatedPlayer1Stats,
          totalInnings: gameState.player1Stats.totalInnings + 1,
          inningStats: [...gameState.player1Stats.inningStats, gameState.currentInningBalls]
        };
      } else {
        updatedPlayer2Stats = {
          ...updatedPlayer2Stats,
          totalInnings: gameState.player2Stats.totalInnings + 1,
          inningStats: [...gameState.player2Stats.inningStats, gameState.currentInningBalls]
        };
      }
    }
    
    const newState = {
      ...gameState,
      currentPlayer: gameState.currentPlayer === 1 ? 2 : 1,
      shotCount: gameState.shotCount + 1,
      currentRackShots: gameState.currentRackShots + 1,
      currentInning: newInning,
      currentInningBalls: 0,
      isNewInning: true,
      currentInningPerfect: true,
      currentInningStartBalls: gameState.ballsOnTable.length,
      player1Fouls: gameState.currentPlayer === 1 ? 0 : gameState.player1Fouls,  // プレイヤー交代でファウルをクリア
      player2Fouls: gameState.currentPlayer === 2 ? 0 : gameState.player2Fouls,  // プレイヤー交代でファウルをクリア
      player1Stats: updatedPlayer1Stats,
      player2Stats: updatedPlayer2Stats,
      shotClockTime: gameSettings.shotClockSeconds, // ショットクロックをリセット
      actionHistory: [...gameState.actionHistory, {
        type: 'switchPlayer',
        previousState
      }]
    };
    
    setGameState(newState);
  };

  const safety = () => {
    const previousState = { ...gameState };
    delete previousState.actionHistory;
    
    // Safetyもプレイヤー交代なので、プレイヤー1に戻る場合はイニング+1
    const newInning = Math.max(1, (gameState.currentPlayer === 2) ? gameState.currentInning + 1 : gameState.currentInning);
    
    // 現在のイニングを終了（直接統計を更新）
    let updatedPlayer1Stats = gameState.player1Stats;
    let updatedPlayer2Stats = gameState.player2Stats;
    
    // ショット数とセーフティ数を増加（現在のプレイヤーがセーフティショットをしたとみなす）
    if (gameState.currentPlayer === 1) {
      updatedPlayer1Stats = {
        ...gameState.player1Stats,
        shotsInGame: gameState.player1Stats.shotsInGame + 1,
        safetiesInGame: gameState.player1Stats.safetiesInGame + 1
      };
    } else {
      updatedPlayer2Stats = {
        ...gameState.player2Stats,
        shotsInGame: gameState.player2Stats.shotsInGame + 1,
        safetiesInGame: gameState.player2Stats.safetiesInGame + 1
      };
    }
    
    if (!gameState.isNewInning) {
      if (gameState.currentPlayer === 1) {
        updatedPlayer1Stats = {
          ...updatedPlayer1Stats,
          totalInnings: gameState.player1Stats.totalInnings + 1,
          inningStats: [...gameState.player1Stats.inningStats, gameState.currentInningBalls]
        };
      } else {
        updatedPlayer2Stats = {
          ...updatedPlayer2Stats,
          totalInnings: gameState.player2Stats.totalInnings + 1,
          inningStats: [...gameState.player2Stats.inningStats, gameState.currentInningBalls]
        };
      }
    }
    
    // Safetyもファウルをクリア
    const newState = {
      ...gameState,
      currentPlayer: gameState.currentPlayer === 1 ? 2 : 1,
      shotCount: gameState.shotCount + 1,
      currentRackShots: gameState.currentRackShots + 1,
      currentInning: newInning,
      currentInningBalls: 0,
      isNewInning: true,
      currentInningPerfect: true,
      currentInningStartBalls: gameState.ballsOnTable.length,
      player1Fouls: gameState.currentPlayer === 1 ? 0 : gameState.player1Fouls,
      player2Fouls: gameState.currentPlayer === 2 ? 0 : gameState.player2Fouls,
      player1Stats: updatedPlayer1Stats,
      player2Stats: updatedPlayer2Stats,
      shotClockTime: gameSettings.shotClockSeconds, // ショットクロックをリセット
      actionHistory: [...gameState.actionHistory, {
        type: 'safety',
        previousState
      }]
    };
    
    setGameState(newState);
  };

  const foul = () => {
    const previousState = { ...gameState };
    delete previousState.actionHistory;
    const rule = getCurrentRule();
    
    const newPlayer1Fouls = gameState.currentPlayer === 1 ? gameState.player1Fouls + 1 : gameState.player1Fouls;
    const newPlayer2Fouls = gameState.currentPlayer === 2 ? gameState.player2Fouls + 1 : gameState.player2Fouls;
    
    // ファウルもプレイヤー交代なので、プレイヤー1に戻る場合はイニング+1
    const newInning = Math.max(1, (gameState.currentPlayer === 2) ? gameState.currentInning + 1 : gameState.currentInning);
    
    // ショット数とファウル数を増加（現在のプレイヤーがファウルしたとみなす）
    let updatedPlayer1Stats = gameState.currentPlayer === 1 
      ? { ...gameState.player1Stats, shotsInGame: gameState.player1Stats.shotsInGame + 1, foulsInGame: gameState.player1Stats.foulsInGame + 1 }
      : gameState.player1Stats;
    let updatedPlayer2Stats = gameState.currentPlayer === 2 
      ? { ...gameState.player2Stats, shotsInGame: gameState.player2Stats.shotsInGame + 1, foulsInGame: gameState.player2Stats.foulsInGame + 1 }
      : gameState.player2Stats;
    
    // 3ファウルチェック（3ファウルルールありの場合のみ、かつ9ボール、JPA9ボール、またはJCL9ボールの場合）
    if (gameState.threeFoulRule && 
        (gameSettings.gameType === '9ボール' || gameSettings.gameType === 'JCL9ボール') &&
        ((gameState.currentPlayer === 1 && newPlayer1Fouls >= 3) || 
        (gameState.currentPlayer === 2 && newPlayer2Fouls >= 3))) {
      // 3ファウルでラック負け
      const winner = gameState.currentPlayer === 1 ? 2 : 1;
      
      // JCL9ボールの場合の特別な得点計算
      let newScore;
      if (gameSettings.gameType === 'JCL9ボール') {
        // 3ファウルした方：そのラックで落とした球数分の点数
        // 相手：14点
        const foulPlayerBalls = gameState.currentPlayer === 1 ? gameState.player1RackBalls : gameState.player2RackBalls;
        const winnerBalls = gameState.currentPlayer === 1 ? gameState.player2RackBalls : gameState.player1RackBalls;
        
        newScore = {
          player1Score: gameState.player1Score + (gameState.currentPlayer === 1 ? foulPlayerBalls : 14),
          player2Score: gameState.player2Score + (gameState.currentPlayer === 2 ? foulPlayerBalls : 14)
        };
      } else {
        // 通常のゲーム：勝者に1点
        newScore = winner === 1 ? 
          { player1Score: gameState.player1Score + 1, player2Score: gameState.player2Score } :
          { player1Score: gameState.player1Score, player2Score: gameState.player2Score + 1 };
      }
      
      // JCL9ボールの場合、ヒルヒル判定を更新
      const newIsHillHill = gameSettings.gameType === 'JCL9ボール' ? 
        checkHillHill(newScore.player1Score, newScore.player2Score, gameSettings.player1Target, gameSettings.player2Target) : 
        gameState.isHillHill;
      
      // 次のラックのブレイクプレイヤーを決定
      let nextBreakPlayer = winner; // デフォルトは勝者ブレイク
      if (gameState.breakRule === 'alternate') {
        // 交互ブレイク: ラック番号が奇数ならP1、偶数ならP2
        nextBreakPlayer = ((gameState.currentRack + 1) % 2 === 1) ? 1 : 2;
      }
      
      // 交互ブレイクで後手から先手（P2→P1）への変更時のみイニング増加
      const newInningForRack = (gameState.breakRule === 'alternate' && gameState.currentPlayer === 2 && nextBreakPlayer === 1) 
        ? newInning + 1 
        : newInning;
      
      const newState = {
        ...gameState,
        ...newScore,
        currentPlayer: nextBreakPlayer,
        ballsOnTable: rule.getInitialBalls(),
        deadBalls: [],
        currentRackShots: 0,
        currentRack: gameState.currentRack + 1,
        currentInning: newInningForRack, // 交互ブレイクのイニング処理
        shotInProgress: false,
        selectedBallsInShot: [],
        player1Fouls: 0,
        player2Fouls: 0,
        pocketedByPlayer: {},
        player1RackBalls: 0,
        player2RackBalls: 0,
        player1Stats: updatedPlayer1Stats,
        player2Stats: updatedPlayer2Stats,
        isHillHill: newIsHillHill,
        lastRackWinner: winner,
        shotClockTime: gameSettings.shotClockSeconds, // ショットクロックをリセット
        player1Extensions: 1, // エクステンションをリセット
        player2Extensions: 1,  // エクステンションをリセット
        actionHistory: [...gameState.actionHistory, {
          type: 'threeFouls',
          previousState
        }]
      };
      
      setGameState(newState);
      
      const winnerName = winner === 1 ? gameSettings.player1.name : gameSettings.player2.name;
      const loserName = winner === 1 ? gameSettings.player2.name : gameSettings.player1.name;
      
      if (gameSettings.gameType === 'JCL9ボール') {
        const foulPlayerBalls = gameState.currentPlayer === 1 ? gameState.player1RackBalls : gameState.player2RackBalls;
        alert(`${loserName}が3ファウル！\n${winnerName}: +14点\n${loserName}: +${foulPlayerBalls}点`);
      } else {
        alert(`${loserName}が3ファウル！${winnerName}がラックを獲得！`);
      }
      
      // ゲーム終了チェック
      // JCL9ボールでヒルヒル状態の場合、3ファウルした方が負け
      if (gameSettings.gameType === 'JCL9ボール' && gameState.isHillHill) {
        const winnerId = winner === 1 ? gameSettings.player1.id : gameSettings.player2.id;
        const loserId = winner === 1 ? gameSettings.player2.id : gameSettings.player1.id;
        const winnerPlayer = winner === 1 ? gameSettings.player1 : gameSettings.player2;
        const loserPlayer = winner === 1 ? gameSettings.player2 : gameSettings.player1;
        
        // 3ファウル時の統計設定
        const finalPlayer1Stats = {
          ...gameState.player1Stats,
          totalInnings: gameState.player1Stats.totalInnings,
          inningStats: gameState.player1Stats.inningStats,
          shotsInGame: updatedPlayer1Stats.shotsInGame,
          safetiesInGame: updatedPlayer1Stats.safetiesInGame || 0,
          foulsInGame: updatedPlayer1Stats.foulsInGame || 0
        };
        
        const finalPlayer2Stats = {
          ...gameState.player2Stats,
          totalInnings: gameState.player2Stats.totalInnings,
          inningStats: gameState.player2Stats.inningStats,
          shotsInGame: updatedPlayer2Stats.shotsInGame,
          safetiesInGame: updatedPlayer2Stats.safetiesInGame || 0,
          foulsInGame: updatedPlayer2Stats.foulsInGame || 0
        };
        
        // 戦績を更新
        updatePlayerStats(finalPlayer1Stats, finalPlayer2Stats, winnerId, loserId, newInning);
        
        // 試合結果データを設定（勝利直前の状態を保存）
        setGameResult({
          winner: winnerPlayer,
          loser: loserPlayer,
          finalScore: {
            player1: newScore.player1Score,
            player2: newScore.player2Score
          },
          gameType: gameSettings.gameType,
          totalShots: gameState.shotCount + 1,
          totalRacks: gameState.currentRack,
          totalInnings: newInning,
          player1Stats: finalPlayer1Stats,
          player2Stats: finalPlayer2Stats,
          gameState: gameState, // 勝利前の状態を保存
          winCondition: '3ファウル（ヒルヒル）'
        });
        
        setCurrentScreen('gameResult');
        return;
      }
      
      // JCL9ボールでヒルヒル状態かつ目標点数に到達した場合
      if (gameSettings.gameType === 'JCL9ボール' && newIsHillHill && 
          (newScore.player1Score >= gameSettings.player1Target || 
           newScore.player2Score >= gameSettings.player2Target)) {
        const winnerId = newScore.player1Score >= gameSettings.player1Target ? gameSettings.player1.id : gameSettings.player2.id;
        const loserId = newScore.player1Score >= gameSettings.player1Target ? gameSettings.player2.id : gameSettings.player1.id;
        const winnerPlayer = newScore.player1Score >= gameSettings.player1Target ? gameSettings.player1 : gameSettings.player2;
        const loserPlayer = newScore.player1Score >= gameSettings.player1Target ? gameSettings.player2 : gameSettings.player1;
        
        // 3ファウル時の統計設定
        const finalPlayer1Stats = {
          ...gameState.player1Stats,
          totalInnings: gameState.player1Stats.totalInnings,
          inningStats: gameState.player1Stats.inningStats
        };
        
        const finalPlayer2Stats = {
          ...gameState.player2Stats,
          totalInnings: gameState.player2Stats.totalInnings,
          inningStats: gameState.player2Stats.inningStats
        };
        
        // 戦績を更新
        updatePlayerStats(finalPlayer1Stats, finalPlayer2Stats, winnerId, loserId, newInning);
        
        // 試合結果データを設定（勝利直前の状態を保存）
        setGameResult({
          winner: winnerPlayer,
          loser: loserPlayer,
          finalScore: {
            player1: newScore.player1Score,
            player2: newScore.player2Score
          },
          gameType: gameSettings.gameType,
          totalShots: gameState.shotCount + 1,
          totalRacks: gameState.currentRack,
          totalInnings: newInning,
          player1Stats: finalPlayer1Stats,
          player2Stats: finalPlayer2Stats,
          gameState: gameState, // 勝利前の状態を保存
          winCondition: '3ファウル（ヒルヒル）'
        });
        
        setCurrentScreen('gameResult');
      }
      // JCL9ボールでヒルヒル状態だが目標点数に達していない場合は継続
      else if (gameSettings.gameType === 'JCL9ボール' && newIsHillHill) {
        // ゲーム継続
        return;
      }
      // 通常の目標点数到達による勝利（JCL9ボール以外のゲームも含む）
      else if (newScore.player1Score >= gameSettings.player1Target || 
          newScore.player2Score >= gameSettings.player2Target) {
        const winnerId = winner === 1 ? gameSettings.player1.id : gameSettings.player2.id;
        const loserId = winner === 1 ? gameSettings.player2.id : gameSettings.player1.id;
        const winnerPlayer = winner === 1 ? gameSettings.player1 : gameSettings.player2;
        const loserPlayer = winner === 1 ? gameSettings.player2 : gameSettings.player1;
        
        // 3ファウル時の統計設定（両プレイヤーとも1イニング）
        const finalPlayer1Stats = {
          ...gameState.player1Stats,
          totalInnings: 1,
          inningStats: [0],
          shotsInGame: updatedPlayer1Stats.shotsInGame,
          safetiesInGame: updatedPlayer1Stats.safetiesInGame || 0,
          foulsInGame: updatedPlayer1Stats.foulsInGame || 0
        };
        
        const finalPlayer2Stats = {
          ...gameState.player2Stats,
          totalInnings: 1,
          inningStats: [0],
          shotsInGame: updatedPlayer2Stats.shotsInGame,
          safetiesInGame: updatedPlayer2Stats.safetiesInGame || 0,
          foulsInGame: updatedPlayer2Stats.foulsInGame || 0
        };
        
        // 戦績を更新
        updatePlayerStats(finalPlayer1Stats, finalPlayer2Stats, winnerId, loserId, newInning);
        
        // 試合結果データを設定（勝利直前の状態を保存）
        setGameResult({
          winner: winnerPlayer,
          loser: loserPlayer,
          finalScore: {
            player1: newScore.player1Score,
            player2: newScore.player2Score
          },
          gameType: gameSettings.gameType,
          totalShots: gameState.shotCount + 1,
          totalRacks: gameState.currentRack,
          totalInnings: newInning, // 3ファウル時点のイニング数
          player1Stats: finalPlayer1Stats,
          player2Stats: finalPlayer2Stats,
          gameState: gameState, // 勝利前の状態を保存
          winCondition: '3ファウル'
        });
        
        setCurrentScreen('gameResult');
      }
      return;
    }
    
    const newState = {
      ...gameState,
      currentPlayer: gameState.currentPlayer === 1 ? 2 : 1,
      shotCount: gameState.shotCount + 1,
      currentRackShots: gameState.currentRackShots + 1,
      currentInning: newInning,
      player1Fouls: newPlayer1Fouls,
      player2Fouls: newPlayer2Fouls,
      player1Stats: updatedPlayer1Stats,
      player2Stats: updatedPlayer2Stats,
      shotClockTime: gameSettings.shotClockSeconds, // ショットクロックをリセット
      actionHistory: [...gameState.actionHistory, {
        type: 'foul',
        previousState
      }]
    };
    
    setGameState(newState);
  };

  const updatePlayerStats = (player1FinalStats, player2FinalStats, winnerId, loserId, gameTotalInnings) => {
    // 簡単モードの場合は統計を更新しない
    if (gameSettings.operationMode === 'simple') {
      return;
    }
    
    setPlayers(prevPlayers => 
      prevPlayers.map(player => {
        if (player.id === winnerId) {
          // 勝者の統計を正しく選択
          const winnerStats = player.id === gameSettings.player1.id ? player1FinalStats : player2FinalStats;
          
          return {
            ...player,
            gamesPlayed: player.gamesPlayed + 1,
            gamesWon: player.gamesWon + 1,
            totalShots: player.totalShots + (winnerStats.shotsInGame || 0),  // フォールバック追加
            successfulShots: player.successfulShots + winnerStats.totalBallsPocketed,
            massWari: player.massWari + winnerStats.massWari,
            totalBallsPocketed: (player.totalBallsPocketed || 0) + winnerStats.totalBallsPocketed,
            totalInnings: (player.totalInnings || 0) + gameTotalInnings,  // ゲーム全体のイニング数を使用
            totalSafeties: (player.totalSafeties || 0) + (winnerStats.safetiesInGame || 0),
            totalFouls: (player.totalFouls || 0) + (winnerStats.foulsInGame || 0)
          };
        } else if (player.id === loserId) {
          // 敗者の統計を正しく選択
          const loserStats = player.id === gameSettings.player1.id ? player1FinalStats : player2FinalStats;
            
          return {
            ...player,
            gamesPlayed: player.gamesPlayed + 1,
            totalShots: player.totalShots + (loserStats.shotsInGame || 0),  // フォールバック追加
            successfulShots: player.successfulShots + loserStats.totalBallsPocketed,
            massWari: player.massWari + loserStats.massWari,
            totalBallsPocketed: (player.totalBallsPocketed || 0) + loserStats.totalBallsPocketed,
            totalInnings: (player.totalInnings || 0) + gameTotalInnings,  // ゲーム全体のイニング数を使用
            totalSafeties: (player.totalSafeties || 0) + (loserStats.safetiesInGame || 0),
            totalFouls: (player.totalFouls || 0) + (loserStats.foulsInGame || 0)
          };
        }
        return player;
      })
    );
  };

  const calculateStats = (player) => {
    const accuracy = player.totalShots > 0 ? ((player.successfulShots / player.totalShots) * 100).toFixed(1) : '0.0';
    const winRate = player.gamesPlayed > 0 ? ((player.gamesWon / player.gamesPlayed) * 100).toFixed(1) : '0.0';
    const avgInningsPerGame = player.gamesPlayed > 0 ? (player.totalInnings / player.gamesPlayed).toFixed(1) : '0.0';
    
    // totalBallsPocketed と totalInnings が存在しない場合のフォールバック
    const totalBalls = player.totalBallsPocketed || 0;
    const totalInnings = player.totalInnings || 0;
    const avgBallsPerInning = totalInnings > 0 ? (totalBalls / totalInnings).toFixed(1) : '0.0';
    
    return { accuracy, winRate, avgInningsPerGame, avgBallsPerInning };
  };

  const BallComponent = ({ ballNumber, isOnTable, isDead, isSelected, pocketedBy, onClick, gameState, gameSettings }) => {
    const isStripe = ballNumber > 8 && ballNumber <= 15;
    const isEightBall = ballNumber === 8;
    
    // 無効球モード中は9番ボールをクリックできないようにする
    const isClickable = isOnTable && !(gameState.deadMode && ballNumber === 9 && (gameSettings.gameType === '9ボール' || gameSettings.gameType === 'JPA9ボール' || gameSettings.gameType === 'JCL9ボール'));
    
    // ボーダーカラーを決定
    const getBorderColor = () => {
      if (isDead) return 'border-red-600';
      if (!isOnTable && pocketedBy) {
        return pocketedBy === 1 ? 'border-amber-600' : 'border-stone-700';
      }
      if (!isOnTable) return 'border-stone-300';
      return 'border-white';
    };
    
    return (
      <button
        onClick={isClickable ? onClick : undefined}
        disabled={!isClickable}
        className={`w-14 h-14 sm:w-[72px] sm:h-[72px] rounded-full flex items-center justify-center font-bold text-base sm:text-lg transition-all duration-300 relative ${
          isOnTable && !isDead && isClickable
            ? 'shadow-lg hover:shadow-xl hover:scale-110 cursor-pointer transform'
            : isOnTable && !isDead && !isClickable
            ? 'shadow-lg cursor-not-allowed transform'
            : 'opacity-30 cursor-not-allowed'
        } ${getBorderColor()} ${
          isSelected ? 'ring-4 ring-amber-500 ring-offset-2 ring-offset-stone-100 scale-110' : ''
        } ${gameState.deadMode && ballNumber === 9 && isOnTable && (gameSettings.gameType === '9ボール' || gameSettings.gameType === 'JPA9ボール' || gameSettings.gameType === 'JCL9ボール') ? 'opacity-50' : ''}`}
        style={{
          backgroundColor: isOnTable && !isDead ? ballColors[ballNumber] : '#e5e5e5',
          borderWidth: !isOnTable && pocketedBy ? '3px' : '2px'
        }}
      >
        {isStripe && isOnTable && !isDead && (
          <div 
            className="absolute inset-0 rounded-full"
            style={{
              background: `linear-gradient(45deg, ${ballColors[ballNumber]} 0%, ${ballColors[ballNumber]} 35%, white 35%, white 65%, ${ballColors[ballNumber]} 65%, ${ballColors[ballNumber]} 100%)`
            }}
          />
        )}
        <span 
          className={`relative z-10 font-bold ${!isOnTable ? 'text-stone-400' : 'text-white'}`}
          style={{
            textShadow: isOnTable && !isDead ? '0 0 3px rgba(0,0,0,0.8)' : 'none'
          }}
        >
          {ballNumber}
        </span>
        {isDead && (
          <div className="absolute -top-1 -right-1 bg-red-600 rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center border border-white">
            <Skull className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
          </div>
        )}
        {isSelected && (
          <div className="absolute -top-1 -left-1 bg-amber-500 rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center border border-white">
            <span className="text-xs sm:text-sm font-bold text-white">✓</span>
          </div>
        )}
        {!isOnTable && pocketedBy && (
          <div className={`absolute -bottom-1 -right-1 ${pocketedBy === 1 ? 'bg-amber-600' : 'bg-stone-700'} text-white rounded-full px-2 py-0.5 text-xs font-bold shadow-lg border-2 border-white`}>
            P{pocketedBy}
          </div>
        )}
      </button>
    );
  };

  // 簡単モード用：ボールを左右にスライドしてプレイヤーに割り当てる
  const handleBallSwipe = (ballNumber, targetPlayer) => {
    console.log('handleBallSwipe called:', { ballNumber, targetPlayer });
    
    // 前の状態を保存
    const previousState = { ...gameState };
    delete previousState.actionHistory;
    
    const rule = getCurrentRule();
    
    if (gameState.ballsOnTable.includes(ballNumber)) {
      const newBallsOnTable = gameState.ballsOnTable.filter(ball => ball !== ballNumber);
      
      // JCL9ボール用のラック内ボール数更新
      const newPlayer1RackBalls = targetPlayer === 1 ? gameState.player1RackBalls + 1 : gameState.player1RackBalls;
      const newPlayer2RackBalls = targetPlayer === 2 ? gameState.player2RackBalls + 1 : gameState.player2RackBalls;
      
      const newState = {
        ...gameState,
        ballsOnTable: newBallsOnTable,
        player1RackBalls: newPlayer1RackBalls,
        player2RackBalls: newPlayer2RackBalls,
        pocketedByPlayer: {
          ...gameState.pocketedByPlayer,
          [ballNumber]: targetPlayer
        },
        actionHistory: [...gameState.actionHistory, {
          type: 'simpleBallSwipe',
          ballNumber,
          targetPlayer,
          previousState
        }]
      };

      console.log('New state:', newState);

      // 9番ボールがスワイプされた場合のJCL9ボール処理
      if (ballNumber === 9 && gameSettings.gameType === 'JCL9ボール') {
        // JCL9ボールの得点計算
        const jclScore = rule.calculateJCLScore(targetPlayer, newPlayer1RackBalls, newPlayer2RackBalls);
        
        const newScore = {
          player1Score: gameState.player1Score + jclScore.player1Score,
          player2Score: gameState.player2Score + jclScore.player2Score
        };
        
        // 得点表示のアラート
        const winner9Name = targetPlayer === 1 ? gameSettings.player1.name : gameSettings.player2.name;
        const winner9Points = jclScore.winner9Points;
        const opponentPoints = jclScore.opponentPoints;
        alert(`🎯 ${winner9Name}が9番ポケット！\n\n${gameSettings.player1.name}: +${jclScore.player1Score}点\n${gameSettings.player2.name}: +${jclScore.player2Score}点\n\n次のラックへ進みます`);
        
        // 次のラックのブレイクプレイヤーを決定（簡単モードは交互ブレイク固定）
        const nextBreakPlayer = ((gameState.currentRack + 1) % 2 === 1) ? 1 : 2;
        
        const finalState = {
          ...newState,
          ...newScore,
          ballsOnTable: rule.getInitialBalls(),
          currentRackShots: 0,
          currentRack: gameState.currentRack + 1,
          currentPlayer: nextBreakPlayer,
          player1RackBalls: 0,
          player2RackBalls: 0,
          pocketedByPlayer: {},
          deadBalls: [],  // 無効球もリセット
          actionHistory: [...newState.actionHistory]  // 履歴を維持
        };
        
        setGameState(finalState);
        
        // ゲーム終了チェック
        if (newScore.player1Score >= gameSettings.player1Target || 
            newScore.player2Score >= gameSettings.player2Target) {
          const winner = newScore.player1Score >= gameSettings.player1Target ? gameSettings.player1 : gameSettings.player2;
          const loser = newScore.player1Score >= gameSettings.player1Target ? gameSettings.player2 : gameSettings.player1;
          
          // 簡単モードでは統計を記録しない
          setGameResult({
            winner: winner,
            loser: loser,
            finalScore: {
              player1: newScore.player1Score,
              player2: newScore.player2Score
            },
            gameType: gameSettings.gameType,
            totalShots: 0,
            totalRacks: gameState.currentRack,
            totalInnings: 0,
            player1Stats: gameState.player1Stats,
            player2Stats: gameState.player2Stats,
            gameState: gameState,
            operationMode: 'simple'
          });
          
          setCurrentScreen('gameResult');
        }
      } else {
        setGameState(newState);
      }
    }
  };

  // 簡単モード用：無効球の切り替え
  const toggleDeadBallSimple = (ballNumber) => {
    // 前の状態を保存
    const previousState = { ...gameState };
    delete previousState.actionHistory;
    
    if (gameState.ballsOnTable.includes(ballNumber)) {
      const isCurrentlyDead = gameState.deadBalls.includes(ballNumber);
      const newDeadBalls = isCurrentlyDead 
        ? gameState.deadBalls.filter(ball => ball !== ballNumber)
        : [...gameState.deadBalls, ballNumber];
      
      const newState = {
        ...gameState,
        deadBalls: newDeadBalls,
        actionHistory: [...gameState.actionHistory, {
          type: 'simpleToggleDead',
          ballNumber,
          wasDead: isCurrentlyDead,
          previousState
        }]
      };
      
      setGameState(newState);
    }
  };

  const SimpleBallComponent = ({ ballNumber, isOnTable, pocketedBy }) => {
    const [showButtons, setShowButtons] = useState(false);
    const isDead = gameState.deadBalls.includes(ballNumber);
    
    if (!isOnTable) return null;
    
    const handlePlayerSelect = (targetPlayer) => {
      handleBallSwipe(ballNumber, targetPlayer);
      setShowButtons(false);
    };
    
    const handleDeadToggle = () => {
      toggleDeadBallSimple(ballNumber);
      setShowButtons(false);
    };
    
    return (
      <div className="relative flex items-center gap-2">
        {/* P1ボタン */}
        {showButtons && !isDead && (
          <button
            onClick={() => handlePlayerSelect(1)}
            className="bg-amber-600 text-white px-2 py-1 rounded text-xs font-bold shadow-lg hover:bg-amber-700 transform hover:scale-110 transition-all"
          >
            P1
          </button>
        )}
        
        {/* ボール */}
        <button
          onClick={() => setShowButtons(!showButtons)}
          className={`relative transform transition-transform hover:scale-110 active:scale-95 ${showButtons ? 'scale-110' : ''}`}
          style={{
            cursor: 'pointer',
            touchAction: 'manipulation',
            userSelect: 'none',
            WebkitUserSelect: 'none'
          }}
        >
          <div
            className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-bold text-sm relative shadow-lg border-2 ${
              isDead ? 'border-red-600 border-4 opacity-60' : showButtons ? 'border-yellow-400 border-4' : 'border-white'
            }`}
            style={{
              backgroundColor: isDead ? '#666' : ballColors[ballNumber]
            }}
          >
            {ballNumber > 8 && ballNumber <= 15 && !isDead && (
              <div 
                className="absolute inset-0 rounded-full pointer-events-none"
                style={{
                  background: `linear-gradient(45deg, ${ballColors[ballNumber]} 0%, ${ballColors[ballNumber]} 35%, white 35%, white 65%, ${ballColors[ballNumber]} 65%, ${ballColors[ballNumber]} 100%)`
                }}
              />
            )}
            <span 
              className="relative z-10 font-bold text-white pointer-events-none"
              style={{
                textShadow: '0 0 3px rgba(0,0,0,0.8)'
              }}
            >
              {ballNumber}
            </span>
            {isDead && (
              <div className="absolute -top-1 -right-1 bg-red-600 rounded-full w-5 h-5 flex items-center justify-center border border-white">
                <Skull className="w-3 h-3 text-white" />
              </div>
            )}
          </div>
        </button>
        
        {/* P2ボタンまたは無効球ボタン */}
        {showButtons && !isDead && (
          <button
            onClick={() => handlePlayerSelect(2)}
            className="bg-stone-700 text-white px-2 py-1 rounded text-xs font-bold shadow-lg hover:bg-stone-800 transform hover:scale-110 transition-all"
          >
            P2
          </button>
        )}
        
        {/* 無効球ボタン */}
        {showButtons && (
          <button
            onClick={handleDeadToggle}
            className={`${isDead ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'} text-white px-2 py-1 rounded text-xs font-bold shadow-lg transform hover:scale-110 transition-all`}
          >
            {isDead ? '有効' : '無効'}
          </button>
        )}
      </div>
    );
  };

  // ホーム画面
  if (currentScreen === 'home') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-stone-100 text-stone-800 flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          {/* ロゴ部分 */}
          <div className="text-center mb-12">
            <h1 className="text-5xl font-serif tracking-[0.2em] mb-3 text-stone-800">
              LUXE
            </h1>
            <div className="w-16 h-px bg-amber-600 mx-auto mb-3"></div>
            <p className="text-sm tracking-[0.3em] text-stone-600 font-light">BILLIARDS</p>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => setCurrentScreen('newGame')}
              className="w-full bg-stone-800 text-amber-50 py-4 px-8 font-light tracking-widest text-base hover:bg-amber-700 transition-all duration-500 transform hover:scale-105 shadow-md hover:shadow-lg"
            >
              NEW GAME
            </button>

            <button
              onClick={() => setCurrentScreen('playerSelect')}
              className="w-full border-2 border-stone-800 text-stone-800 py-4 px-8 font-light tracking-widest text-base hover:bg-stone-800 hover:text-amber-50 transition-all duration-500 transform hover:scale-105 shadow-md hover:shadow-lg"
            >
              RECORDS
            </button>
          </div>
          
          <div className="mt-16 text-center">
            <p className="text-sm tracking-[0.2em] text-stone-500 font-light">
              ESTABLISHED 2024
            </p>
          </div>
        </div>
      </div>
    );
  }

  // プレイヤー選択画面
  if (currentScreen === 'playerSelect') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-stone-100 text-stone-800 p-6">
        <div className="max-w-2xl mx-auto">
          <div className="relative mb-10">
            <button
              onClick={() => setCurrentScreen('home')}
              className="absolute left-0 top-0 text-stone-600 hover:text-stone-800 transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="text-center">
              <h2 className="text-3xl font-serif tracking-wider mb-2 text-stone-800">プレイヤー選択</h2>
              <div className="w-12 h-px bg-amber-600 mx-auto"></div>
            </div>
          </div>

          <div className="space-y-3">
            {players.map(player => (
              <div key={player.id} className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setSelectedPlayer(player);
                    setCurrentScreen('records');
                  }}
                  className="flex-1 border-2 border-stone-300 hover:border-amber-600 bg-white p-5 transition-all duration-300 group shadow-sm hover:shadow-md"
                >
                  <div className="flex justify-between items-center">
                    <div className="text-left">
                      <h3 className="font-medium tracking-wide text-lg text-stone-800 group-hover:text-amber-700 transition-colors">
                        {player.name}
                      </h3>
                      <p className="text-sm text-stone-500 mt-1 font-light">ID.{player.id}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-stone-500 font-light">勝率</p>
                      <p className="text-2xl font-light text-amber-700">
                        {player.gamesPlayed > 0 ? 
                          ((player.gamesWon / player.gamesPlayed) * 100).toFixed(0) : 
                          '0'
                        }%
                      </p>
                    </div>
                  </div>
                </button>
                {player.id > 2 && (
                  <button
                    onClick={() => deletePlayer(player.id)}
                    className="border-2 border-red-700 hover:bg-red-700 text-red-700 hover:text-white px-4 py-2 transition-all duration-300 text-sm font-light tracking-wide"
                  >
                    削除
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 新規ゲーム設定画面
  if (currentScreen === 'newGame') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-stone-100 text-stone-800 p-8">
        <div className="max-w-2xl mx-auto">
          <div className="mb-12">
            <button
              onClick={() => setCurrentScreen('home')}
              className="mb-8 text-stone-600 hover:text-stone-800 transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h2 className="text-3xl font-serif tracking-[0.2em] mb-2 text-stone-800">GAME SETUP</h2>
            <div className="w-12 h-px bg-amber-600"></div>
          </div>

          <div className="space-y-8">
            {/* ゲームタイプ選択 */}
            <div>
              <label className="block text-xs tracking-[0.2em] text-stone-600 mb-3 font-light">
                GAME TYPE
              </label>
              <div className="relative">
                <select
                  value={gameSettings.gameType}
                  onChange={(e) => {
                    const newGameType = e.target.value;
                    const rule = GameRules[newGameType];
                    setGameSettings({
                      ...gameSettings, 
                      gameType: newGameType,
                      isJCL: rule.isJCL,
                      player1Target: rule.defaultTarget,
                      player2Target: rule.defaultTarget,
                      breakRule: newGameType === 'JCL9ボール' ? 'alternate' : 'winner',
                      threeFoulRule: newGameType === 'JPA9ボール' ? false : true,
                      chessClockMinutes: newGameType === 'JCL9ボール' ? 25 : 15,
                      shotClockSeconds: newGameType === 'JCL9ボール' ? 40 : 30,
                      extensionSeconds: newGameType === 'JCL9ボール' ? 40 : 30,
                      useChessClock: false,
                      operationMode: newGameType === 'JCL9ボール' ? gameSettings.operationMode : 'custom'
                    });
                  }}
                  className="w-full bg-white border border-stone-300 p-4 appearance-none font-light tracking-wider focus:border-amber-600 transition-colors shadow-sm"
                >
                  {Object.keys(GameRules).map(ruleName => (
                    <option key={ruleName} value={ruleName} className="bg-white">{ruleName}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-stone-600" />
              </div>
              {gameSettings.gameType === 'JPA9ボール' && (
                <div className="mt-4 p-4 border border-blue-600 bg-blue-100/50">
                  <p className="text-sm tracking-wider text-blue-800 leading-relaxed">
                    <strong>JPA9ボールルール:</strong><br/>
                    • 1-8番は各1点、9番は2点<br/>
                    • 勝者ブレイク・3ファウルなし<br/>
                    • チェスクロック・ショットクロックなし<br/>
                    • 最小番号から順にポケット、9番でラック獲得
                  </p>
                </div>
              )}
              {gameSettings.gameType === 'JCL9ボール' && (
                <div className="mt-4 p-4 border border-amber-600 bg-amber-100/50">
                  <p className="text-sm tracking-wider text-amber-800 leading-relaxed">
                    <strong>JCL9ボールルール:</strong><br/>
                    • 最小番号から順にポケット<br/>
                    • 9番ポケットで14点獲得<br/>
                    • 相手は入れたボール数分の点数<br/>
                    • <strong>ヒルヒル:</strong> 両者が14点以内で目標に届く場合、9番を落とした方が勝利
                  </p>
                </div>
              )}
            </div>

            {/* 操作モード選択（JCL9ボールのみ） */}
            {gameSettings.gameType === 'JCL9ボール' && (
              <div>
                <label className="block text-sm font-light tracking-wider text-stone-600 mb-2">
                  操作モード
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setGameSettings({...gameSettings, operationMode: 'simple'})}
                    className={`border-2 p-3 font-light tracking-wide transition-all duration-300 text-base shadow-sm ${
                      gameSettings.operationMode === 'simple' 
                        ? 'border-amber-600 bg-amber-100 text-amber-800' 
                        : 'border-stone-300 hover:border-stone-400 text-stone-600 bg-white'
                    }`}
                  >
                    簡単モード
                  </button>
                  <button
                    onClick={() => setGameSettings({...gameSettings, operationMode: 'custom'})}
                    className={`border-2 p-3 font-light tracking-wide transition-all duration-300 text-base shadow-sm ${
                      gameSettings.operationMode === 'custom' 
                        ? 'border-amber-600 bg-amber-100 text-amber-800' 
                        : 'border-stone-300 hover:border-stone-400 text-stone-600 bg-white'
                    }`}
                  >
                    カスタムモード
                  </button>
                </div>
                {gameSettings.operationMode === 'simple' && (
                  <p className="text-xs text-red-600 mt-2">
                    ※ 操作が簡単な代わりに各種統計データが記録されないモードです
                  </p>
                )}
                {gameSettings.operationMode === 'custom' && (
                  <p className="text-xs text-blue-600 mt-2">
                    ※ 各種統計データが記録できます
                  </p>
                )}
              </div>
            )}

            {/* ブレイクルール選択（簡単モード以外、JPA9ボール以外） */}
            {gameSettings.gameType !== 'JPA9ボール' && (gameSettings.gameType !== 'JCL9ボール' || gameSettings.operationMode === 'custom') && (
              <div>
                <label className="block text-sm font-light tracking-wider text-stone-600 mb-2">
                  ブレイクルール
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setGameSettings({...gameSettings, breakRule: 'winner'})}
                    className={`border-2 p-3 font-light tracking-wide transition-all duration-300 text-base shadow-sm ${
                      gameSettings.breakRule === 'winner' 
                        ? 'border-amber-600 bg-amber-100 text-amber-800' 
                        : 'border-stone-300 hover:border-stone-400 text-stone-600 bg-white'
                    }`}
                  >
                    勝者ブレイク
                  </button>
                  <button
                    onClick={() => setGameSettings({...gameSettings, breakRule: 'alternate'})}
                    className={`border-2 p-3 font-light tracking-wide transition-all duration-300 text-base shadow-sm ${
                      gameSettings.breakRule === 'alternate' 
                        ? 'border-amber-600 bg-amber-100 text-amber-800' 
                        : 'border-stone-300 hover:border-stone-400 text-stone-600 bg-white'
                    }`}
                  >
                    交互ブレイク
                  </button>
                </div>
                {gameSettings.gameType === 'JCL9ボール' && (
                  <p className="text-xs text-amber-700 mt-2">
                    ※ JCL9ボールは交互ブレイクが推奨されます
                  </p>
                )}
              </div>
            )}

            {/* 3ファウルルール選択（9ボール、JCL9ボールのカスタムモードのみ、JPA9ボール以外） */}
            {gameSettings.gameType !== 'JPA9ボール' && (gameSettings.gameType === '9ボール' || (gameSettings.gameType === 'JCL9ボール' && gameSettings.operationMode === 'custom')) && (
              <div>
                <label className="block text-sm font-light tracking-wider text-stone-600 mb-2">
                  3ファウルルール
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setGameSettings({...gameSettings, threeFoulRule: true})}
                    className={`border-2 p-3 font-light tracking-wide transition-all duration-300 text-base shadow-sm ${
                      gameSettings.threeFoulRule 
                        ? 'border-amber-600 bg-amber-100 text-amber-800' 
                        : 'border-stone-300 hover:border-stone-400 text-stone-600 bg-white'
                    }`}
                  >
                    あり
                  </button>
                  <button
                    onClick={() => setGameSettings({...gameSettings, threeFoulRule: false})}
                    className={`border-2 p-3 font-light tracking-wide transition-all duration-300 text-base shadow-sm ${
                      !gameSettings.threeFoulRule 
                        ? 'border-amber-600 bg-amber-100 text-amber-800' 
                        : 'border-stone-300 hover:border-stone-400 text-stone-600 bg-white'
                    }`}
                  >
                    なし
                  </button>
                </div>
                <p className="text-xs text-stone-500 mt-2">
                  ※ 「あり」の場合、3回連続ファウルでラック負けとなります
                </p>
              </div>
            )}

            {/* チェスクロック選択（9ボール、JCL9ボールのカスタムモード、JPA9ボール以外） */}
            {gameSettings.gameType !== 'JPA9ボール' && (gameSettings.gameType === '9ボール' || (gameSettings.gameType === 'JCL9ボール' && gameSettings.operationMode === 'custom')) && (
              <div>
                <label className="block text-sm font-light tracking-wider text-stone-600 mb-2">
                  チェスクロック＆ショットクロック
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setGameSettings({...gameSettings, useChessClock: true})}
                    className={`border-2 p-3 font-light tracking-wide transition-all duration-300 text-base shadow-sm ${
                      gameSettings.useChessClock 
                        ? 'border-amber-600 bg-amber-100 text-amber-800' 
                        : 'border-stone-300 hover:border-stone-400 text-stone-600 bg-white'
                    }`}
                  >
                    使用する
                  </button>
                  <button
                    onClick={() => setGameSettings({...gameSettings, useChessClock: false})}
                    className={`border-2 p-3 font-light tracking-wide transition-all duration-300 text-base shadow-sm ${
                      !gameSettings.useChessClock 
                        ? 'border-amber-600 bg-amber-100 text-amber-800' 
                        : 'border-stone-300 hover:border-stone-400 text-stone-600 bg-white'
                    }`}
                  >
                    使用しない
                  </button>
                </div>
                
                {/* 時間設定 */}
                {gameSettings.useChessClock && (
                  <div className="mt-4 space-y-3">
                    <div>
                      <label className="block text-xs text-stone-600 mb-1">
                        チェスクロック（分）
                      </label>
                      <input
                        type="number"
                        value={gameSettings.chessClockMinutes}
                        onChange={(e) => setGameSettings({...gameSettings, chessClockMinutes: parseInt(e.target.value) || 1})}
                        className="w-full bg-white border border-stone-300 p-2 font-light tracking-wider focus:border-amber-600 transition-colors text-center shadow-sm"
                        min="1"
                        max="60"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-stone-600 mb-1">
                        ショットクロック（秒）
                      </label>
                      <input
                        type="number"
                        value={gameSettings.shotClockSeconds}
                        onChange={(e) => setGameSettings({...gameSettings, shotClockSeconds: parseInt(e.target.value) || 10})}
                        className="w-full bg-white border border-stone-300 p-2 font-light tracking-wider focus:border-amber-600 transition-colors text-center shadow-sm"
                        min="10"
                        max="120"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-stone-600 mb-1">
                        エクステンション（秒）
                      </label>
                      <input
                        type="number"
                        value={gameSettings.extensionSeconds}
                        onChange={(e) => setGameSettings({...gameSettings, extensionSeconds: parseInt(e.target.value) || 10})}
                        className="w-full bg-white border border-stone-300 p-2 font-light tracking-wider focus:border-amber-600 transition-colors text-center shadow-sm"
                        min="10"
                        max="120"
                      />
                    </div>
                    <p className="text-xs text-stone-500">
                      ※ エクステンション: 1ラック1回（ショットクロック +{gameSettings.extensionSeconds}秒）
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* JPA9ボールの固定設定表示 */}
            {gameSettings.gameType === 'JPA9ボール' && (
              <div>
                <label className="block text-sm font-light tracking-wider text-stone-600 mb-2">
                  設定（固定）
                </label>
                <div className="border-2 border-stone-300 p-4 bg-stone-50 space-y-2 text-sm text-stone-700">
                  <div>• ブレイクルール: 勝者ブレイク</div>
                  <div>• 3ファウルルール: なし</div>
                  <div>• チェスクロック: なし</div>
                  <div>• ショットクロック: なし</div>
                  <div>• エクステンション: なし</div>
                </div>
              </div>
            )}

            {/* プレイヤー選択 */}
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-xs tracking-[0.2em] text-stone-600 font-light">PLAYER 1</label>
                <label className="text-xs tracking-[0.2em] text-stone-600 font-light">PLAYER 2</label>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <select
                    value={gameSettings.player1?.id || ''}
                    onChange={(e) => {
                      const player = players.find(p => p.id === parseInt(e.target.value));
                      setGameSettings({...gameSettings, player1: player});
                    }}
                    className="w-full bg-white border border-stone-300 p-2 appearance-none font-light tracking-wider focus:border-amber-600 transition-colors shadow-sm text-sm"
                  >
                    <option value="" className="bg-white">Select</option>
                    {players.map(player => (
                      <option key={player.id} value={player.id} className="bg-white">
                        {player.id}.{player.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-stone-600" />
                </div>

                <button
                  onClick={swapPlayers}
                  className="p-2 border-2 border-stone-300 hover:border-amber-600 transition-all duration-300 bg-white shadow-sm"
                  title="プレイヤーを入れ替え"
                >
                  <ArrowLeftRight className="w-4 h-4 text-stone-600" />
                </button>

                <div className="relative flex-1">
                  <select
                    value={gameSettings.player2?.id || ''}
                    onChange={(e) => {
                      const player = players.find(p => p.id === parseInt(e.target.value));
                      setGameSettings({...gameSettings, player2: player});
                    }}
                    className="w-full bg-white border border-stone-300 p-2 appearance-none font-light tracking-wider focus:border-amber-600 transition-colors shadow-sm text-sm"
                  >
                    <option value="" className="bg-white">Select</option>
                    {players.map(player => (
                      <option key={player.id} value={player.id} className="bg-white">
                        {player.id}.{player.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-stone-600" />
                </div>
              </div>
            </div>

            {/* 目標設定 */}
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-xs tracking-[0.2em] text-stone-600 font-light">P1 RACE TO</label>
                <label className="text-xs tracking-[0.2em] text-stone-600 font-light">P2 RACE TO</label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={gameSettings.player1Target}
                  onChange={(e) => setGameSettings({...gameSettings, player1Target: parseInt(e.target.value)})}
                  className="flex-1 bg-white border border-stone-300 p-2 font-light tracking-wider focus:border-amber-600 transition-colors text-center shadow-sm text-sm"
                  min={gameSettings.isJCL ? "10" : gameSettings.gameType === 'JPA9ボール' ? "1" : "1"}
                  max={gameSettings.isJCL ? "200" : gameSettings.gameType === 'JPA9ボール' ? "75" : "10"}
                  step={gameSettings.isJCL ? "5" : "1"}
                />
                
                <button
                  onClick={swapTargets}
                  className="p-2 border-2 border-stone-300 hover:border-amber-600 transition-all duration-300 bg-white shadow-sm"
                  title="目標を入れ替え"
                >
                  <ArrowLeftRight className="w-4 h-4 text-stone-600" />
                </button>

                <input
                  type="number"
                  value={gameSettings.player2Target}
                  onChange={(e) => setGameSettings({...gameSettings, player2Target: parseInt(e.target.value)})}
                  className="flex-1 bg-white border border-stone-300 p-2 font-light tracking-wider focus:border-amber-600 transition-colors text-center shadow-sm text-sm"
                  min={gameSettings.isJCL ? "10" : gameSettings.gameType === 'JPA9ボール' ? "1" : "1"}
                  max={gameSettings.isJCL ? "200" : gameSettings.gameType === 'JPA9ボール' ? "75" : "10"}
                  step={gameSettings.isJCL ? "5" : "1"}
                />
              </div>
            </div>

            {/* 新規プレイヤー追加 */}
            <div>
              {!showNewPlayerForm ? (
                <button
                  onClick={() => setShowNewPlayerForm(true)}
                  className="w-full border border-stone-300 border-dashed p-4 text-stone-500 hover:text-stone-700 hover:border-stone-400 transition-colors text-xs tracking-[0.2em] bg-white"
                >
                  + ADD NEW PLAYER
                </button>
              ) : (
                <div className="space-y-4">
                  <input
                    type="text"
                    value={newPlayerName}
                    onChange={(e) => setNewPlayerName(e.target.value)}
                    placeholder="PLAYER NAME"
                    className="w-full bg-white border border-stone-300 p-4 font-light tracking-wider focus:border-amber-600 transition-colors placeholder-stone-400 shadow-sm"
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={addNewPlayer}
                      className="border border-amber-600 text-amber-700 hover:bg-amber-600 hover:text-white py-3 transition-all duration-300 tracking-wider text-sm font-light shadow-sm"
                    >
                      CONFIRM
                    </button>
                    <button
                      onClick={() => {
                        setShowNewPlayerForm(false);
                        setNewPlayerName('');
                      }}
                      className="border border-stone-300 hover:bg-stone-100 py-3 transition-all duration-300 tracking-wider text-sm font-light text-stone-600 shadow-sm bg-white"
                    >
                      CANCEL
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ゲーム開始ボタン */}
            <button
              onClick={startGame}
              disabled={!gameSettings.player1 || !gameSettings.player2}
              className="w-full bg-amber-600 text-white py-4 font-light tracking-[0.3em] hover:bg-amber-700 disabled:bg-stone-300 disabled:text-stone-500 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 disabled:scale-100 shadow-md hover:shadow-lg"
            >
              START GAME
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ゲーム画面（簡単モード）
  if (currentScreen === 'game' && gameSettings.gameType === 'JCL9ボール' && gameState.operationMode === 'simple') {
    const rule = getCurrentRule();
    const ballCount = rule.ballCount;
    const ballsToShow = Array.from({ length: ballCount }, (_, i) => i + 1);
    
    // 各プレイヤーがポケットしたボール
    const player1Balls = ballsToShow.filter(ball => gameState.pocketedByPlayer[ball] === 1);
    const player2Balls = ballsToShow.filter(ball => gameState.pocketedByPlayer[ball] === 2);
    const remainingBalls = ballsToShow.filter(ball => gameState.ballsOnTable.includes(ball));
    
    // ブレイクプレイヤーを計算（交互ブレイク固定）
    const breakPlayer = gameState.currentRack % 2 === 1 ? 1 : 2;
    
    return (
      <div className="h-screen bg-gradient-to-br from-amber-50 to-stone-100 text-stone-800 p-4 flex flex-col overflow-auto">
        <div className="max-w-5xl mx-auto w-full flex-1 flex flex-col">
          <div className="relative mb-4 flex-shrink-0">
            <button
              onClick={() => setCurrentScreen('home')}
              className="absolute left-0 top-0 text-stone-600 hover:text-stone-800 transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h2 className="text-center text-xl font-light tracking-[0.2em] text-stone-700">JCL9ボール - 簡単モード</h2>
          </div>

          {/* ゲームエリア全体のグリッド */}
          <div className="grid grid-cols-3 gap-2 flex-1">
            {/* プレイヤー1エリア */}
            <div className="flex flex-col items-center">
              <div className="text-center mb-2">
                <h3 className="font-medium tracking-wider text-base text-stone-800">{gameSettings.player1.name}</h3>
                <div className="text-3xl font-light text-amber-700">{gameState.player1Score}</div>
                <div className="text-xs text-stone-600 font-light">Race to {gameSettings.player1Target}</div>
                {breakPlayer === 1 && (
                  <div className="text-xs text-amber-600 font-medium mt-1 border border-amber-600 rounded px-2 py-0.5 inline-block">
                    BREAK
                  </div>
                )}
              </div>
              {/* プレイヤー1のボール */}
              <div className="flex flex-col gap-1 items-center">
                {player1Balls.map(ballNumber => (
                  <div
                    key={ballNumber}
                    className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-bold text-sm relative shadow-lg border-4 border-amber-600 opacity-70`}
                    style={{
                      backgroundColor: ballColors[ballNumber]
                    }}
                  >
                    {ballNumber > 8 && ballNumber <= 15 && (
                      <div 
                        className="absolute inset-0 rounded-full"
                        style={{
                          background: `linear-gradient(45deg, ${ballColors[ballNumber]} 0%, ${ballColors[ballNumber]} 35%, white 35%, white 65%, ${ballColors[ballNumber]} 65%, ${ballColors[ballNumber]} 100%)`
                        }}
                      />
                    )}
                    <span 
                      className="relative z-10 font-bold text-white"
                      style={{
                        textShadow: '0 0 3px rgba(0,0,0,0.8)'
                      }}
                    >
                      {ballNumber}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 中央エリア（テーブル上のボール） */}
            <div className="flex flex-col items-center">
              <div className="text-center mb-2">
                <div className="text-xl font-light text-stone-500">VS</div>
                <div className="text-sm text-stone-600 font-light">RACK {gameState.currentRack}</div>
                <div className="text-xs text-stone-500">
                  残り: {remainingBalls.length}球
                </div>
                {gameState.deadBalls.length > 0 && (
                  <div className="text-xs text-red-600 font-medium">
                    無効球: {gameState.deadBalls.length}個
                  </div>
                )}
              </div>
              
              {/* テーブル上のボール */}
              <div className="flex flex-col gap-1 items-center">
                {remainingBalls.map(ballNumber => (
                  <SimpleBallComponent
                    key={ballNumber}
                    ballNumber={ballNumber}
                    isOnTable={true}
                    pocketedBy={null}
                  />
                ))}
              </div>
            </div>

            {/* プレイヤー2エリア */}
            <div className="flex flex-col items-center">
              <div className="text-center mb-2">
                <h3 className="font-medium tracking-wider text-base text-stone-800">{gameSettings.player2.name}</h3>
                <div className="text-3xl font-light text-stone-700">{gameState.player2Score}</div>
                <div className="text-xs text-stone-600 font-light">Race to {gameSettings.player2Target}</div>
                {breakPlayer === 2 && (
                  <div className="text-xs text-stone-600 font-medium mt-1 border border-stone-600 rounded px-2 py-0.5 inline-block">
                    BREAK
                  </div>
                )}
              </div>
              {/* プレイヤー2のボール */}
              <div className="flex flex-col gap-1 items-center">
                {player2Balls.map(ballNumber => (
                  <div
                    key={ballNumber}
                    className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-bold text-sm relative shadow-lg border-4 border-stone-700 opacity-70`}
                    style={{
                      backgroundColor: ballColors[ballNumber]
                    }}
                  >
                    {ballNumber > 8 && ballNumber <= 15 && (
                      <div 
                        className="absolute inset-0 rounded-full"
                        style={{
                          background: `linear-gradient(45deg, ${ballColors[ballNumber]} 0%, ${ballColors[ballNumber]} 35%, white 35%, white 65%, ${ballColors[ballNumber]} 65%, ${ballColors[ballNumber]} 100%)`
                        }}
                      />
                    )}
                    <span 
                      className="relative z-10 font-bold text-white"
                      style={{
                        textShadow: '0 0 3px rgba(0,0,0,0.8)'
                      }}
                    >
                      {ballNumber}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* UNDOボタン（CHANGEボタンと同じデザイン） */}
          <div className="mt-6 mb-2 flex-shrink-0">
            <button
              onClick={undoSimpleMode}
              disabled={gameState.actionHistory.length === 0}
              className={`w-full py-4 sm:py-5 font-medium tracking-wider text-base sm:text-lg transition-all duration-300 shadow-md ${
                gameState.actionHistory.length === 0
                  ? 'bg-stone-300 text-stone-500 cursor-not-allowed' 
                  : 'border-2 border-green-600 hover:bg-green-600 hover:text-white bg-white text-green-700'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <RotateCcw className="w-6 h-6 sm:w-7 sm:h-7" />
                <span>UNDO</span>
              </div>
            </button>
          </div>

          {/* 操作説明 */}
          <div className="mt-2 text-center text-sm text-stone-500 flex-shrink-0">
            <p>ボールをクリックしてプレイヤーを選択または無効球に設定</p>
          </div>
        </div>
      </div>
    );
  }

  // ゲーム画面（通常モード）は変更なし
  if (currentScreen === 'game') {
    const currentPlayerName = gameState.currentPlayer === 1 ? gameSettings.player1.name : gameSettings.player2.name;
    const rule = getCurrentRule();
    const ballCount = rule.ballCount;
    const ballsToShow = Array.from({ length: ballCount }, (_, i) => i + 1);
    
    // 各プレイヤーの現在のラックでの落球数を計算
    const player1RackPocketed = Object.values(gameState.pocketedByPlayer).filter(p => p === 1).length;
    const player2RackPocketed = Object.values(gameState.pocketedByPlayer).filter(p => p === 2).length;
    
    // 現在のプレイヤーがショットクロックモードかどうかをチェック
    const isCurrentPlayerUsingShootClock = gameState.currentPlayer === 1 
      ? gameState.player1IsUsingShootClock 
      : gameState.player2IsUsingShootClock;
    
    return (
      <div className="h-screen bg-gradient-to-br from-amber-50 to-stone-100 text-stone-800 p-2 sm:p-4 flex flex-col overflow-auto">
        <div className="max-w-5xl mx-auto w-full flex-1 flex flex-col">
          <div className="relative mb-2 sm:mb-6 flex-shrink-0">
            <button
              onClick={() => setCurrentScreen('home')}
              className="absolute left-0 top-0 text-stone-600 hover:text-stone-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            <h2 className="text-center text-sm sm:text-base font-light tracking-[0.2em] text-stone-700">{gameSettings.gameType}</h2>
            <div className="absolute right-0 top-0 text-xs sm:text-sm font-light text-stone-500">
              <span className="hidden sm:inline">START TIME: </span>{gameState.startTime}
            </div>
          </div>

          {/* スコア表示 */}
          <div className="grid grid-cols-2 gap-2 sm:gap-6 mb-2 sm:mb-6 flex-shrink-0">
            <div className={`border-2 p-2 sm:p-4 transition-all duration-300 shadow-md ${gameState.currentPlayer === 1 ? 'border-amber-600 bg-amber-100/50' : 'border-stone-300 bg-white'}`}>
              <div className="text-center">
                <h3 className="font-medium tracking-wider text-sm sm:text-base mb-1 sm:mb-2 text-stone-800">{gameSettings.player1.name}</h3>
                {gameState.useChessClock && (
                  <div className={`text-sm sm:text-base mb-1 font-mono ${
                    gameState.currentPlayer === 1 && gameState.player1IsUsingShootClock ? 'text-red-600 font-bold' : 
                    gameState.currentPlayer === 1 ? 'text-amber-700' : 'text-stone-500'
                  }`}>
                    {gameState.currentPlayer === 1 && gameState.player1IsUsingShootClock 
                      ? `SHOT: ${gameState.shotClockTime}s` 
                      : formatTime(gameState.player1ChessTime)}
                  </div>
                )}
                {gameState.player1Fouls > 0 && (
                  <div className="text-xs sm:text-sm text-red-600 mb-1">
                    FOUL × {gameState.player1Fouls}
                  </div>
                )}
                <div className="text-3xl sm:text-5xl font-light mb-0 sm:mb-1 text-stone-900">{gameState.player1Score}</div>
                <div className="text-xs sm:text-sm text-stone-600 font-light">Race to {gameSettings.player1Target}</div>
                {gameState.useChessClock && gameState.player1Extensions > 0 && gameState.currentPlayer === 1 && gameState.player1IsUsingShootClock && (
                  <div className="text-xs text-amber-600 mt-1">
                    EXT: {gameState.player1Extensions}
                  </div>
                )}
              </div>
            </div>
            <div className={`border-2 p-2 sm:p-4 transition-all duration-300 shadow-md ${gameState.currentPlayer === 2 ? 'border-amber-600 bg-amber-100/50' : 'border-stone-300 bg-white'}`}>
              <div className="text-center">
                <h3 className="font-medium tracking-wider text-sm sm:text-base mb-1 sm:mb-2 text-stone-800">{gameSettings.player2.name}</h3>
                {gameState.useChessClock && (
                  <div className={`text-sm sm:text-base mb-1 font-mono ${
                    gameState.currentPlayer === 2 && gameState.player2IsUsingShootClock ? 'text-red-600 font-bold' : 
                    gameState.currentPlayer === 2 ? 'text-amber-700' : 'text-stone-500'
                  }`}>
                    {gameState.currentPlayer === 2 && gameState.player2IsUsingShootClock 
                      ? `SHOT: ${gameState.shotClockTime}s` 
                      : formatTime(gameState.player2ChessTime)}
                  </div>
                )}
                {gameState.player2Fouls > 0 && (
                  <div className="text-xs sm:text-sm text-red-600 mb-1">
                    FOUL × {gameState.player2Fouls}
                  </div>
                )}
                <div className="text-3xl sm:text-5xl font-light mb-0 sm:mb-1 text-stone-900">{gameState.player2Score}</div>
                <div className="text-xs sm:text-sm text-stone-600 font-light">Race to {gameSettings.player2Target}</div>
                {gameState.useChessClock && gameState.player2Extensions > 0 && gameState.currentPlayer === 2 && gameState.player2IsUsingShootClock && (
                  <div className="text-xs text-amber-600 mt-1">
                    EXT: {gameState.player2Extensions}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ラック・イニング表示 */}
          <div className="text-center mb-2 sm:mb-6 flex-shrink-0">
            <div className="inline-flex items-center gap-2 sm:gap-6 text-xs sm:text-sm font-light tracking-wider text-stone-700 bg-white px-3 sm:px-6 py-1 sm:py-2 rounded-full shadow-sm border border-stone-200">
              <span>RACK {gameState.currentRack}</span>
              <span className="w-px h-3 sm:h-4 bg-stone-300"></span>
              <span>INNING {Math.max(1, gameState.currentInning)}</span>
              <span className="w-px h-3 sm:h-4 bg-stone-300"></span>
              <span className="text-xs text-stone-500">{gameState.breakRule === 'winner' ? '勝者ブレイク' : '交互ブレイク'}</span>
            </div>
            {gameSettings.gameType === 'JCL9ボール' && gameState.isHillHill && (
              <div className="mt-1 sm:mt-3 p-1 sm:p-3 bg-red-100 border-2 border-red-400 text-red-700 text-xs sm:text-base font-medium tracking-wide">
                🔥 HILL HILL! Winner takes all with the 9-ball! 🔥
              </div>
            )}
          </div>

          {/* ショット管理表示 */}
          {gameState.shotInProgress && (
            <div className="text-center mb-2 sm:mb-4 flex-shrink-0">
              <div className="inline-flex items-center gap-2 sm:gap-4 text-sm sm:text-base font-medium tracking-wider text-amber-700 bg-amber-100 px-3 sm:px-6 py-1 sm:py-2 rounded-full shadow-sm border border-amber-300">
                <span>SHOT MODE</span>
                <span className="text-lg sm:text-2xl">{gameState.selectedBallsInShot.length}</span>
              </div>
            </div>
          )}
          
          {/* 無効球モード表示 */}
          {gameState.deadMode && (
            <div className="text-center mb-2 sm:mb-4 flex-shrink-0">
              <div className="inline-flex items-center gap-2 sm:gap-4 text-sm sm:text-base font-medium tracking-wider text-red-700 bg-red-100 px-3 sm:px-6 py-1 sm:py-2 rounded-full shadow-sm border border-red-300">
                <Skull className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>無効球モード</span>
              </div>
            </div>
          )}

          {/* ボール表示 */}
          <div className="mb-2 sm:mb-6 flex-shrink-0">
            {gameState.deadBalls.length > 0 && (
              <div className="text-center mb-1 sm:mb-3">
                <span className="text-xs sm:text-sm font-medium text-red-600 tracking-wider">
                  無効球: {gameState.deadBalls.length}個
                </span>
              </div>
            )}
            <div className={`grid gap-2 sm:gap-4 ${ballCount === 9 ? 'grid-cols-5' : 'grid-cols-5'} sm:max-w-md mx-auto`}>
              {ballsToShow.map(ballNumber => (
                <BallComponent
                  key={ballNumber}
                  ballNumber={ballNumber}
                  isOnTable={gameState.ballsOnTable.includes(ballNumber)}
                  isDead={gameState.deadBalls.includes(ballNumber)}
                  isSelected={gameState.selectedBallsInShot.includes(ballNumber)}
                  pocketedBy={gameState.pocketedByPlayer[ballNumber]}
                  onClick={() => pocketBall(ballNumber)}
                  gameState={gameState}
                  gameSettings={gameSettings}
                />
              ))}
            </div>
          </div>

          {/* チェスクロックコントロール */}
          {gameState.useChessClock && (
            <div className="mb-2 flex-shrink-0 flex gap-2">
              <button
                onClick={toggleClockPause}
                className={`flex-1 py-2 sm:py-3 font-medium tracking-wider text-sm sm:text-base transition-all duration-300 shadow-md border-2 ${
                  gameState.isClockPaused 
                    ? 'border-red-600 bg-red-100 text-red-700 hover:bg-red-200' 
                    : 'border-blue-600 bg-white text-blue-700 hover:bg-blue-600 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-center gap-1 sm:gap-2">
                  {gameState.isClockPaused ? <PlayCircle className="w-4 h-4 sm:w-5 sm:h-5" /> : <Pause className="w-4 h-4 sm:w-5 sm:h-5" />}
                  <span>{gameState.isClockPaused ? 'RESUME' : 'PAUSE'}</span>
                </div>
              </button>
              
              {isCurrentPlayerUsingShootClock && (
                <button
                  onClick={useExtension}
                  disabled={
                    (gameState.currentPlayer === 1 && gameState.player1Extensions === 0) ||
                    (gameState.currentPlayer === 2 && gameState.player2Extensions === 0)
                  }
                  className={`px-4 py-2 sm:py-3 font-medium tracking-wider text-sm sm:text-base transition-all duration-300 shadow-md border-2 ${
                    ((gameState.currentPlayer === 1 && gameState.player1Extensions === 0) ||
                     (gameState.currentPlayer === 2 && gameState.player2Extensions === 0))
                      ? 'border-stone-300 bg-stone-100 text-stone-400 cursor-not-allowed' 
                      : 'border-amber-600 bg-white text-amber-700 hover:bg-amber-600 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1 sm:gap-2">
                    <Timer className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span>+{gameSettings.extensionSeconds}s</span>
                  </div>
                </button>
              )}
            </div>
          )}

          {/* CHANGEボタンを上に配置 */}
          <div className="mb-2 sm:mb-4 flex-shrink-0">
            <button
              onClick={switchPlayer}
              disabled={gameState.shotInProgress || gameState.deadMode}
              className={`w-full py-4 sm:py-5 font-medium tracking-wider text-base sm:text-lg transition-all duration-300 shadow-md ${
                gameState.shotInProgress || gameState.deadMode
                  ? 'bg-stone-300 text-stone-500 cursor-not-allowed' 
                  : 'border-2 border-green-600 hover:bg-green-600 hover:text-white bg-white text-green-700'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <RotateCcw className="w-6 h-6 sm:w-7 sm:h-7" />
                <span>CHANGE</span>
              </div>
            </button>
          </div>

          {/* 操作ボタン */}
          <div className="grid grid-cols-5 gap-1 sm:gap-2 flex-shrink-0">
            <button
              onClick={undoLastAction}
              disabled={gameState.actionHistory.length === 0}
              className="border-2 border-stone-300 hover:border-amber-600 disabled:border-stone-200 disabled:text-stone-400 p-2 sm:p-3 transition-all duration-300 flex flex-col items-center justify-center gap-0 sm:gap-1 bg-white shadow-sm text-stone-700"
            >
              <Undo className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-[10px] sm:text-xs font-light">UNDO</span>
              {gameState.actionHistory.length > 0 && (() => {
                const lastAction = gameState.actionHistory[gameState.actionHistory.length - 1];
                let displayText = '';
                
                switch(lastAction.type) {
                  case 'pocketBall':
                    displayText = lastAction.ballNumber;
                    break;
                  case 'switchPlayer':
                    displayText = 'CHANGE';
                    break;
                  case 'safety':
                    displayText = 'SAFETY';
                    break;
                  case 'deadBall':
                  case 'undeadBall':
                  case 'toggleDeadMode':
                    displayText = 'DEAD';
                    break;
                  case 'foul':
                  case 'threeFouls':
                    displayText = 'FOUL';
                    break;
                  case 'startShot':
                  case 'endShotSuccess':
                  case 'endShotMiss':
                    displayText = 'DOUBLE';
                    break;
                  case 'selectBall':
                    displayText = `SEL ${lastAction.ballNumber}`;
                    break;
                  default:
                    displayText = '?';
                }
                
                return (
                  <span className="text-[10px] sm:text-xs text-amber-600 font-bold -mt-1 sm:mt-0">{displayText}</span>
                );
              })()}
            </button>

            <button
              onClick={toggleShotMode}
              disabled={gameState.deadMode}
              className={`border-2 p-2 sm:p-3 transition-all duration-300 flex flex-col items-center justify-center gap-0 sm:gap-1 shadow-sm ${
                gameState.shotInProgress 
                  ? 'border-amber-600 bg-amber-100 text-amber-700' 
                  : gameState.deadMode
                  ? 'border-stone-200 bg-stone-100 text-stone-400 cursor-not-allowed'
                  : 'border-stone-300 hover:border-amber-600 hover:text-amber-700 bg-white text-stone-700'
              }`}
            >
              <Play className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-[10px] sm:text-xs font-light">{gameState.shotInProgress ? 'END SHOT' : 'DOUBLE IN'}</span>
            </button>

            <button
              onClick={safety}
              disabled={gameState.shotInProgress || gameState.deadMode}
              className={`border-2 border-stone-300 hover:border-blue-600 hover:text-blue-700 p-2 sm:p-3 transition-all duration-300 flex flex-col items-center justify-center gap-0 sm:gap-1 bg-white shadow-sm text-stone-700 ${
                gameState.shotInProgress || gameState.deadMode ? 'opacity-30 cursor-not-allowed' : ''
              }`}
            >
              <Shield className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-[10px] sm:text-xs font-light">SAFETY</span>
            </button>

            <button
              onClick={toggleDeadMode}
              disabled={gameState.shotInProgress}
              className={`border-2 p-2 sm:p-3 transition-all duration-300 flex flex-col items-center justify-center gap-0 sm:gap-1 shadow-sm ${
                gameState.deadMode 
                  ? 'border-red-600 bg-red-100 text-red-700' 
                  : 'border-stone-300 hover:border-red-600 hover:text-red-700 bg-white text-stone-700'
              } ${gameState.shotInProgress ? 'opacity-30' : ''}`}
            >
              <Skull className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-[10px] sm:text-xs font-light">DEAD</span>
            </button>

            <button
              onClick={foul}
              disabled={gameState.shotInProgress || gameState.deadMode}
              className={`border-2 border-stone-300 hover:border-orange-600 hover:text-orange-700 p-2 sm:p-3 transition-all duration-300 flex flex-col items-center justify-center gap-0 sm:gap-1 bg-white shadow-sm text-stone-700 ${
                gameState.shotInProgress || gameState.deadMode ? 'opacity-30 cursor-not-allowed' : ''
              }`}
            >
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-[10px] sm:text-xs font-light">FOUL</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 記録画面
  if (currentScreen === 'records' && selectedPlayer) {
    const stats = calculateStats(selectedPlayer);
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-stone-100 text-stone-800 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="relative mb-10">
            <button
              onClick={() => setCurrentScreen('playerSelect')}
              className="absolute left-0 top-0 text-stone-600 hover:text-stone-800 transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="text-center">
              <h2 className="text-3xl font-serif tracking-wider mb-2">PLAYER RECORDS</h2>
              <div className="w-12 h-px bg-amber-600 mx-auto"></div>
            </div>
          </div>

          <div className="mb-10 text-center">
            <h3 className="text-4xl font-light tracking-wide mb-2 text-stone-900">{selectedPlayer.name}</h3>
            {selectedPlayer.id > 2 && (
              <button
                onClick={() => {
                  deletePlayer(selectedPlayer.id);
                  setCurrentScreen('playerSelect');
                }}
                className="mt-4 border-2 border-red-700 hover:bg-red-700 text-red-700 hover:text-white px-6 py-2 transition-all duration-300 text-sm font-light tracking-wide"
              >
                プレイヤーを削除
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="border-2 border-stone-300 p-5 bg-white shadow-sm">
                <h4 className="text-sm font-medium tracking-wider text-stone-600 mb-4">ゲーム成績</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-baseline">
                    <span className="text-base text-stone-600">総ゲーム数</span>
                    <span className="text-xl font-light text-stone-900">{selectedPlayer.gamesPlayed}</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-base text-stone-600">勝利数</span>
                    <span className="text-xl font-light text-amber-700">{selectedPlayer.gamesWon}</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-base text-stone-600">敗北数</span>
                    <span className="text-xl font-light text-red-700">{selectedPlayer.gamesPlayed - selectedPlayer.gamesWon}</span>
                  </div>
                  <div className="pt-3 border-t border-stone-200">
                    <div className="flex justify-between items-baseline">
                      <span className="text-base text-stone-600">勝率</span>
                      <span className="text-3xl font-light text-amber-700">{stats.winRate}%</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="border-2 border-stone-300 p-5 bg-white shadow-sm">
                <h4 className="text-sm font-medium tracking-wider text-stone-600 mb-4">特別記録</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-baseline">
                    <span className="text-base text-stone-600">マスワリ</span>
                    <span className="text-xl font-light text-purple-700">{selectedPlayer.massWari}</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-base text-stone-600">セーフティ数</span>
                    <span className="text-xl font-light text-blue-600">{selectedPlayer.totalSafeties || 0}</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-base text-stone-600">ファウル数</span>
                    <span className="text-xl font-light text-red-600">{selectedPlayer.totalFouls || 0}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="border-2 border-stone-300 p-5 bg-white shadow-sm">
                <h4 className="text-sm font-medium tracking-wider text-stone-600 mb-4">ショット統計</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-baseline">
                    <span className="text-base text-stone-600">総ショット数</span>
                    <span className="text-xl font-light text-stone-900">{selectedPlayer.totalShots}</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-base text-stone-600">成功ショット</span>
                    <span className="text-xl font-light text-blue-700">{selectedPlayer.successfulShots}</span>
                  </div>
                  <div className="pt-3 border-t border-stone-200">
                    <div className="flex justify-between items-baseline">
                      <span className="text-base text-stone-600">精度</span>
                      <span className="text-3xl font-light text-blue-700">{stats.accuracy}%</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="border-2 border-stone-300 p-5 bg-white shadow-sm">
                <h4 className="text-sm font-medium tracking-wider text-stone-600 mb-4">平均値</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-baseline">
                    <span className="text-base text-stone-600">1ゲーム平均イニング</span>
                    <span className="text-xl font-light text-stone-900">{stats.avgInningsPerGame}</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-base text-stone-600">1イニング平均落球</span>
                    <span className="text-xl font-light text-stone-900">{stats.avgBallsPerInning}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-8 border-2 border-stone-300 p-6 bg-white shadow-sm">
            <h4 className="text-sm font-medium tracking-wider text-stone-600 mb-6">パフォーマンス指標</h4>
            <div className="space-y-5">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-stone-600 font-light">勝率</span>
                  <span className="text-amber-700 font-medium">{stats.winRate}%</span>
                </div>
                <div className="w-full h-2 bg-stone-200 rounded-full relative">
                  <div 
                    className="absolute h-2 bg-amber-600 rounded-full transition-all duration-1000" 
                    style={{ width: `${Math.min(parseFloat(stats.winRate), 100)}%` }}
                  ></div>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-stone-600 font-light">精度</span>
                  <span className="text-blue-700 font-medium">{stats.accuracy}%</span>
                </div>
                <div className="w-full h-2 bg-stone-200 rounded-full relative">
                  <div 
                    className="absolute h-2 bg-blue-600 rounded-full transition-all duration-1000" 
                    style={{ width: `${Math.min(parseFloat(stats.accuracy), 100)}%` }}
                  ></div>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-stone-600 font-light">経験値</span>
                  <span className="text-purple-700 font-medium">{selectedPlayer.gamesPlayed}</span>
                </div>
                <div className="w-full h-2 bg-stone-200 rounded-full relative">
                  <div 
                    className="absolute h-2 bg-purple-600 rounded-full transition-all duration-1000" 
                    style={{ width: `${Math.min((selectedPlayer.gamesPlayed / 50) * 100, 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 試合結果画面
  if (currentScreen === 'gameResult' && gameResult) {
    const isJCL = gameResult.gameType === 'JCL9ボール';
    const isSimpleMode = gameResult.operationMode === 'simple';
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-stone-100 text-stone-800 p-6 flex items-center justify-center">
        <div className="max-w-3xl w-full">
          <div className="text-center mb-10">
            <div className="text-7xl mb-6 text-amber-600">♔</div>
            <h2 className="text-4xl font-serif tracking-wider mb-3">VICTORY</h2>
            <div className="text-2xl font-medium tracking-wide text-amber-700 mb-3">
              {gameResult.winner.name}
            </div>
            {gameResult.winCondition && (
              <div className="text-base font-light tracking-wide text-stone-600">
                {gameResult.winCondition}
              </div>
            )}
          </div>

          {/* 最終スコア */}
          <div className="border-2 border-stone-300 p-6 mb-6 bg-white shadow-md">
            <h3 className="text-sm font-medium tracking-wider text-stone-600 mb-4 text-center">最終スコア</h3>
            <div className="grid grid-cols-3 gap-6 items-center">
              <div className="text-center">
                <div className="text-base tracking-wide text-stone-600 mb-2 font-light">{gameSettings.player1.name}</div>
                <div className="text-4xl font-light text-stone-900">{gameResult.finalScore.player1}</div>
                {(isJCL || gameResult.gameType === 'JPA9ボール') && (
                  <div className="text-sm text-stone-500 mt-1 font-light">
                    Race to {gameSettings.player1Target}
                  </div>
                )}
              </div>
              <div className="text-center">
                <div className="text-xl font-light text-stone-500">VS</div>
              </div>
              <div className="text-center">
                <div className="text-base tracking-wide text-stone-600 mb-2 font-light">{gameSettings.player2.name}</div>
                <div className="text-4xl font-light text-stone-900">{gameResult.finalScore.player2}</div>
                {(isJCL || gameResult.gameType === 'JPA9ボール') && (
                  <div className="text-sm text-stone-500 mt-1 font-light">
                    Race to {gameSettings.player2Target}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ゲーム統計（簡単モード以外） */}
          {!isSimpleMode && (
            <div className="grid grid-cols-2 gap-6 mb-10">
              <div className="border-2 border-stone-300 p-5 bg-white shadow-sm">
                <h4 className="text-sm font-medium tracking-wider text-stone-600 mb-3">ゲーム統計</h4>
                <div className="space-y-2 text-base">
                  <div className="flex justify-between">
                    <span className="text-stone-600 font-light">タイプ</span>
                    <span className="font-medium text-stone-800">{gameResult.gameType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-600 font-light">ショット数</span>
                    <span className="font-medium text-stone-800">{gameResult.totalShots}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-600 font-light">ラック数</span>
                    <span className="font-medium text-stone-800">{gameResult.totalRacks}</span>
                  </div>
                </div>
              </div>

              <div className="border-2 border-stone-300 p-5 bg-white shadow-sm">
                <h4 className="text-sm font-medium tracking-wider text-stone-600 mb-3">プレイヤー統計</h4>
                <div className="space-y-3 text-base">
                  <div>
                    <div className="text-stone-600 mb-1 font-light">{gameSettings.player1.name}</div>
                    <div className="font-medium text-stone-800">
                      {gameResult.player1Stats.totalBallsPocketed}球 / {gameResult.totalInnings}イニング
                      {gameResult.player1Stats.massWari > 0 && (
                        <span className="text-purple-700 ml-2">MW: {gameResult.player1Stats.massWari}</span>
                      )}
                    </div>
                    <div className="text-sm text-stone-600 mt-1">
                      S: {gameResult.player1Stats.safetiesInGame || 0} / F: {gameResult.player1Stats.foulsInGame || 0}
                    </div>
                  </div>
                  <div>
                    <div className="text-stone-600 mb-1 font-light">{gameSettings.player2.name}</div>
                    <div className="font-medium text-stone-800">
                      {gameResult.player2Stats.totalBallsPocketed}球 / {gameResult.totalInnings}イニング
                      {gameResult.player2Stats.massWari > 0 && (
                        <span className="text-purple-700 ml-2">MW: {gameResult.player2Stats.massWari}</span>
                      )}
                    </div>
                    <div className="text-sm text-stone-600 mt-1">
                      S: {gameResult.player2Stats.safetiesInGame || 0} / F: {gameResult.player2Stats.foulsInGame || 0}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 簡単モードの場合の表示 */}
          {isSimpleMode && (
            <div className="mb-10 text-center p-6 border-2 border-stone-300 bg-white shadow-sm">
              <p className="text-lg text-stone-600">
                簡単モードでプレイしました
              </p>
              <p className="text-sm text-stone-500 mt-2">
                ※ 統計データは記録されていません
              </p>
            </div>
          )}

          {/* ボタン */}
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => {
                setGameState(gameResult.gameState);
                setCurrentScreen('game');
              }}
              className="border-2 border-stone-300 hover:border-amber-600 hover:text-amber-700 py-4 transition-all duration-300 text-base font-light tracking-wider bg-white shadow-sm text-stone-700"
            >
              試合に戻る
            </button>
            
            <button
              onClick={() => {
                setGameResult(null);
                setCurrentScreen('home');
              }}
              className="bg-stone-800 text-amber-50 hover:bg-amber-700 py-4 transition-all duration-300 text-base font-light tracking-wider shadow-md hover:shadow-lg"
            >
              ホームへ
            </button>
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-stone-500 font-light">
              ※試合に戻ると勝利直前の状態に復元されます
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default BilliardsApp;
