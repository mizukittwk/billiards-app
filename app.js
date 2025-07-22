import React, { useState, useEffect } from 'react';
import { ChevronDown, Users, Play, BarChart3, RotateCcw, Shield, AlertCircle, Skull, ArrowLeft, Undo, ArrowLeftRight } from 'lucide-react';

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
  const [showAd, setShowAd] = useState(false);
  const [adCountdown, setAdCountdown] = useState(5);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [players, setPlayers] = useState([
    { id: 1, name: 'プレイヤー1', gamesPlayed: 0, gamesWon: 0, totalShots: 0, successfulShots: 0, massWari: 0, totalBallsPocketed: 0, totalInnings: 0 },
    { id: 2, name: 'プレイヤー2', gamesPlayed: 0, gamesWon: 0, totalShots: 0, successfulShots: 0, massWari: 0, totalBallsPocketed: 0, totalInnings: 0 }
  ]);
  const [gameSettings, setGameSettings] = useState({
    gameType: '9ボール',
    player1: null,
    player2: null,
    player1Target: 3,
    player2Target: 3,
    isJCL: false,
    breakRule: 'winner', // 'winner' or 'alternate'
    threeFoulRule: true // 3ファウルルールのあり/なし
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
    selectedDeadBalls: [], // 無効級選択用
    player1Stats: {
      totalBallsPocketed: 0,
      totalInnings: 0,
      massWari: 0,
      inningStats: []
    },
    player2Stats: {
      totalBallsPocketed: 0,
      totalInnings: 0,
      massWari: 0,
      inningStats: []
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
    lastRackWinner: null // 前のラックの勝者
  });
  const [newPlayerName, setNewPlayerName] = useState('');
  const [showNewPlayerForm, setShowNewPlayerForm] = useState(false);
  const [gameResult, setGameResult] = useState(null);

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
        totalInnings: 0
      };
      setPlayers([...players, newPlayer]);
      setNewPlayerName('');
      setShowNewPlayerForm(false);
    }
  };

  const swapPlayers = () => {
    setGameSettings({
      ...gameSettings,
      player1: gameSettings.player2,
      player2: gameSettings.player1
    });
  };

  const swapTargets = () => {
    setGameSettings({
      ...gameSettings,
      player1Target: gameSettings.player2Target,
      player2Target: gameSettings.player1Target
    });
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
      // 広告を表示
      setShowAd(true);
      setAdCountdown(5);
      
      // カウントダウンタイマー
      const timer = setInterval(() => {
        setAdCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            setShowAd(false);
            // 実際にゲームを開始
            initializeGame();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  };

  const initializeGame = () => {
    const rule = getCurrentRule();
    const initialBalls = rule.getInitialBalls();
    
    // JCL9ボールの場合、ヒルヒル判定
    const isHillHill = gameSettings.gameType === 'JCL9ボール' ? 
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
      selectedDeadBalls: [],
      player1Stats: {
        totalBallsPocketed: 0,
        totalInnings: 0,
        massWari: 0,
        inningStats: []
      },
      player2Stats: {
        totalBallsPocketed: 0,
        totalInnings: 0,
        massWari: 0,
        inningStats: []
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
      breakRule: gameSettings.breakRule,
      threeFoulRule: gameSettings.threeFoulRule,
      lastRackWinner: null
    });
    setCurrentScreen('game');
  };

  const undoLastAction = () => {
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
      totalBallsPocketed: currentPlayerStats.totalBallsPocketed + ballsPoketedCount
    };

    // マスワリ判定（9ボールの場合、ノーミスで1イニングで全ボール取り切った場合）
    const rule = getCurrentRule();
    if (gameSettings.gameType === '9ボール' && gameState.selectedBallsInShot.includes(9) && 
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
        
        const finalState = {
          ...newState,
          ...updatedScore,
          ballsOnTable: rule.getInitialBalls(),
          deadBalls: [],
          currentRackShots: 0,
          currentRack: gameState.currentRack + 1,
          currentInning: gameState.currentInning,
          currentInningBalls: 0,
          isNewInning: true,
          currentInningPerfect: true,
          currentInningStartBalls: rule.ballCount,
          shotInProgress: false,
          selectedBallsInShot: [],
          pocketedByPlayer: {},
          player1RackBalls: 0,
          player2RackBalls: 0,
          player1Fouls: 0, // ファウル数をリセット
          player2Fouls: 0, // ファウル数をリセット
          isHillHill: newIsHillHill,
          currentPlayer: nextBreakPlayer,
          lastRackWinner: gameState.currentPlayer
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
          updatePlayerStats(gameState.player1Stats, gameState.player2Stats, winnerId, loserId);
          
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
          updatePlayerStats(gameState.player1Stats, gameState.player2Stats, winnerId, loserId);
          
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
        
        const finalState = {
          ...updatedScore,
          ballsOnTable: rule.getInitialBalls(),
          deadBalls: [],
          currentRackShots: 0,
          currentRack: gameState.currentRack + 1,
          currentInning: gameState.currentInning,
          currentInningBalls: 0,
          isNewInning: true,
          currentInningPerfect: true,
          currentInningStartBalls: rule.ballCount,
          shotInProgress: false,
          selectedBallsInShot: [],
          pocketedByPlayer: {},
          player1Fouls: 0, // ファウル数をリセット
          player2Fouls: 0, // ファウル数をリセット
          currentPlayer: nextBreakPlayer,
          lastRackWinner: gameState.currentPlayer
        };
        
        setGameState(finalState);

        // ゲーム終了チェック
        if (updatedScore.player1Score >= gameSettings.player1Target || 
            updatedScore.player2Score >= gameSettings.player2Target) {
          const winner = gameState.currentPlayer === 1 ? gameSettings.player1.name : gameSettings.player2.name;
          const winnerId = gameState.currentPlayer === 1 ? gameSettings.player1.id : gameSettings.player2.id;
          const loserId = gameState.currentPlayer === 1 ? gameSettings.player2.id : gameSettings.player1.id;
          
          // 戦績を更新
          updatePlayerStats(gameState.player1Stats, gameState.player2Stats, winnerId, loserId);
          
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
      totalBallsPocketed: currentPlayerStats.totalBallsPocketed + ballsPoketedCount
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
        
        // ラックをリセット
        const finalState = {
          ...newState,
          ...newScore,
          ballsOnTable: rule.getInitialBalls(),
          deadBalls: [],
          currentRackShots: 0,
          currentRack: gameState.currentRack + 1,
          currentInning: gameState.currentInning, // イニングをリセットしない
          currentInningBalls: 0,
          isNewInning: true,
          pocketedByPlayer: {},
          player1RackBalls: 0,
          player2RackBalls: 0,
          player1Fouls: 0, // ファウル数をリセット
          player2Fouls: 0, // ファウル数をリセット
          isHillHill: newIsHillHill,
          currentPlayer: nextBreakPlayer,
          lastRackWinner: gameState.currentPlayer
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
          updatePlayerStats(updatedPlayerStats, gameState.currentPlayer === 1 ? gameState.player2Stats : gameState.player1Stats, winnerId, loserId);
          
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
                          winnerId, loserId);
          
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
        
        // ラックをリセット
        const finalState = {
          ...updatedScore,
          ballsOnTable: rule.getInitialBalls(),
          deadBalls: [],
          currentRackShots: 0,
          currentRack: gameState.currentRack + 1,
          currentInning: gameState.currentInning, // イニングをリセットしない
          currentInningBalls: 0,
          isNewInning: true,
          pocketedByPlayer: {},
          player1Fouls: 0, // ファウル数をリセット
          player2Fouls: 0, // ファウル数をリセット
          currentPlayer: nextBreakPlayer,
          lastRackWinner: gameState.currentPlayer
        };
        
        setGameState(finalState);
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
    
    if (gameState.deadMode) {
      // 無効級モードを終了し、選択したボールを無効級にする
      const validDeadBalls = gameState.selectedDeadBalls.filter(ball => 
        gameState.ballsOnTable.includes(ball) && 
        !((gameSettings.gameType === '9ボール' || gameSettings.gameType === 'JCL9ボール') && ball === 9)
      );
      
      const newDeadBalls = [...new Set([...gameState.deadBalls, ...validDeadBalls])];
      
      const newState = {
        ...gameState,
        deadMode: false,
        deadBalls: newDeadBalls,
        selectedDeadBalls: [],
        actionHistory: [...gameState.actionHistory, {
          type: 'toggleDeadMode',
          addedDeadBalls: validDeadBalls,
          previousState
        }]
      };
      
      setGameState(newState);
    } else {
      // 無効級モードを開始
      const newState = {
        ...gameState,
        deadMode: true,
        selectedDeadBalls: [],
        actionHistory: [...gameState.actionHistory, {
          type: 'toggleDeadMode',
          previousState
        }]
      };
      
      setGameState(newState);
    }
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
      // 無効級モード - 複数選択
      // 9ボールとJCL9ボールでは9番を無効球にできない
      if ((gameSettings.gameType === '9ボール' || gameSettings.gameType === 'JCL9ボール') && ballNumber === 9) {
        alert('9番ボールは無効球にできません');
        return;
      }
      
      if (gameState.ballsOnTable.includes(ballNumber)) {
        const isSelected = gameState.selectedDeadBalls.includes(ballNumber);
        const newSelectedDeadBalls = isSelected 
          ? gameState.selectedDeadBalls.filter(ball => ball !== ballNumber)
          : [...gameState.selectedDeadBalls, ballNumber];
        
        const newState = {
          ...gameState,
          selectedDeadBalls: newSelectedDeadBalls,
          actionHistory: [...gameState.actionHistory, {
            type: 'selectDeadBall',
            ballNumber,
            isSelected: !isSelected,
            previousState
          }]
        };
        
        setGameState(newState);
      } else if (gameState.deadBalls.includes(ballNumber)) {
        // 既に無効級のボールをクリックした場合は解除
        const newDeadBalls = gameState.deadBalls.filter(ball => ball !== ballNumber);
        
        const newState = {
          ...gameState,
          deadBalls: newDeadBalls,
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
          totalBallsPocketed: currentPlayerStats.totalBallsPocketed + 1
        };

        // JCL9ボール用のラック内ボール数更新
        const newPlayer1RackBalls = gameState.currentPlayer === 1 ? gameState.player1RackBalls + 1 : gameState.player1RackBalls;
        const newPlayer2RackBalls = gameState.currentPlayer === 2 ? gameState.player2RackBalls + 1 : gameState.player2RackBalls;

        // マスワリ判定（9ボールまたはJCL9ボールの場合、ノーミスで1イニングで全ボール取り切った場合）
        if ((gameSettings.gameType === '9ボール' || gameSettings.gameType === 'JCL9ボール') && ballNumber === 9 && 
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
            // JCL9ボール終了時：両プレイヤーとも1イニングとして確実に記録
            const finalPlayer1Stats = {
              ...gameState.player1Stats,
              totalBallsPocketed: gameState.currentPlayer === 1 ? updatedPlayerStats.totalBallsPocketed : gameState.player1Stats.totalBallsPocketed,
              totalInnings: 1,
              massWari: gameState.currentPlayer === 1 ? updatedPlayerStats.massWari : gameState.player1Stats.massWari,
              inningStats: [gameState.currentPlayer === 1 ? newCurrentInningBalls : 0]
            };
            
            const finalPlayer2Stats = {
              ...gameState.player2Stats,
              totalBallsPocketed: gameState.currentPlayer === 2 ? updatedPlayerStats.totalBallsPocketed : gameState.player2Stats.totalBallsPocketed,
              totalInnings: 1,
              massWari: gameState.currentPlayer === 2 ? updatedPlayerStats.massWari : gameState.player2Stats.massWari,
              inningStats: [gameState.currentPlayer === 2 ? newCurrentInningBalls : 0]
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
            
            const finalState = {
              ...newState,
              ...newScore,
              ballsOnTable: rule.getInitialBalls(),
              deadBalls: [],
              currentRackShots: 0,
              currentRack: gameState.currentRack + 1,
              currentInning: gameState.currentInning, // イニングをリセットしない
              currentInningBalls: 0,
              isNewInning: true,
              currentInningPerfect: true,
              currentInningStartBalls: rule.ballCount,
              shotInProgress: false,
              selectedBallsInShot: [],
              player1RackBalls: 0,
              player2RackBalls: 0,
              player1Stats: finalPlayer1Stats,
              player2Stats: finalPlayer2Stats,
              pocketedByPlayer: {},
              player1Fouls: 0, // ファウル数をリセット
              player2Fouls: 0, // ファウル数をリセット
              isHillHill: newIsHillHill,
              currentPlayer: nextBreakPlayer,
              lastRackWinner: gameState.currentPlayer
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
              updatePlayerStats(finalPlayer1Stats, finalPlayer2Stats, winnerId, loserId);
              
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
              updatePlayerStats(finalPlayer1Stats, finalPlayer2Stats, winnerId, loserId);
              
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
          } else {
            // 通常の9ボール・8ボール処理
            // ラック終了時に現在のイニングの統計を確実に更新
            let finalPlayer1Stats = updatedPlayerStats;
            let finalPlayer2Stats = gameState.player2Stats;
            
            if (gameState.currentPlayer === 1) {
              finalPlayer1Stats = {
                ...updatedPlayerStats,
                totalInnings: updatedPlayerStats.totalInnings + 1,
                inningStats: [...updatedPlayerStats.inningStats, newCurrentInningBalls]
              };
            } else {
              finalPlayer2Stats = {
                ...gameState.player2Stats,
                totalInnings: gameState.player2Stats.totalInnings + 1,
                inningStats: [...gameState.player2Stats.inningStats, newCurrentInningBalls]
              };
              finalPlayer1Stats = gameState.player1Stats;
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
            
            const finalState = {
              ...updatedScore,
              ballsOnTable: rule.getInitialBalls(),
              deadBalls: [],
              currentRackShots: 0,
              currentRack: gameState.currentRack + 1,
              currentInning: gameState.currentInning, // イニングをリセットしない
              currentInningBalls: 0,
              isNewInning: true,
              currentInningPerfect: true,
              currentInningStartBalls: rule.ballCount,
              shotInProgress: false,
              selectedBallsInShot: [],
              player1Stats: finalPlayer1Stats,
              player2Stats: finalPlayer2Stats,
              player1RackBalls: 0,
              player2RackBalls: 0,
              pocketedByPlayer: {},
              player1Fouls: 0, // ファウル数をリセット
              player2Fouls: 0, // ファウル数をリセット
              currentPlayer: nextBreakPlayer,
              lastRackWinner: gameState.currentPlayer
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
              updatePlayerStats(finalPlayer1Stats, finalPlayer2Stats, winnerId, loserId);
              
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
          setGameState(newState);
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
    
    if (!gameState.isNewInning) {
      if (gameState.currentPlayer === 1) {
        updatedPlayer1Stats = {
          ...gameState.player1Stats,
          totalInnings: gameState.player1Stats.totalInnings + 1,
          inningStats: [...gameState.player1Stats.inningStats, gameState.currentInningBalls]
        };
      } else {
        updatedPlayer2Stats = {
          ...gameState.player2Stats,
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
      player1Stats: updatedPlayer1Stats,
      player2Stats: updatedPlayer2Stats,
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
    
    if (!gameState.isNewInning) {
      if (gameState.currentPlayer === 1) {
        updatedPlayer1Stats = {
          ...gameState.player1Stats,
          totalInnings: gameState.player1Stats.totalInnings + 1,
          inningStats: [...gameState.player1Stats.inningStats, gameState.currentInningBalls]
        };
      } else {
        updatedPlayer2Stats = {
          ...gameState.player2Stats,
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
    
    // 3ファウルチェック（3ファウルルールありの場合のみ、かつ9ボールまたはJCL9ボールの場合）
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
      
      const newState = {
        ...gameState,
        ...newScore,
        currentPlayer: nextBreakPlayer,
        ballsOnTable: rule.getInitialBalls(),
        deadBalls: [],
        currentRackShots: 0,
        currentRack: gameState.currentRack + 1,
        currentInning: newInning, // 計算されたイニングを使用（リセットしない）
        shotInProgress: false,
        selectedBallsInShot: [],
        player1Fouls: 0,
        player2Fouls: 0,
        pocketedByPlayer: {},
        player1RackBalls: 0,
        player2RackBalls: 0,
        isHillHill: newIsHillHill,
        lastRackWinner: winner,
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
          inningStats: gameState.player1Stats.inningStats
        };
        
        const finalPlayer2Stats = {
          ...gameState.player2Stats,
          totalInnings: gameState.player2Stats.totalInnings,
          inningStats: gameState.player2Stats.inningStats
        };
        
        // 戦績を更新
        updatePlayerStats(finalPlayer1Stats, finalPlayer2Stats, winnerId, loserId);
        
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
        updatePlayerStats(finalPlayer1Stats, finalPlayer2Stats, winnerId, loserId);
        
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
          inningStats: [0]
        };
        
        const finalPlayer2Stats = {
          ...gameState.player2Stats,
          totalInnings: 1,
          inningStats: [0]
        };
        
        // 戦績を更新
        updatePlayerStats(finalPlayer1Stats, finalPlayer2Stats, winnerId, loserId);
        
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
      actionHistory: [...gameState.actionHistory, {
        type: 'foul',
        previousState
      }]
    };
    
    setGameState(newState);
  };

  const updatePlayerStats = (player1FinalStats, player2FinalStats, winnerId, loserId) => {
    setPlayers(prevPlayers => 
      prevPlayers.map(player => {
        if (player.id === winnerId) {
          // 勝者の統計を正しく選択
          const winnerStats = player.id === gameSettings.player1.id ? player1FinalStats : player2FinalStats;
          
          return {
            ...player,
            gamesPlayed: player.gamesPlayed + 1,
            gamesWon: player.gamesWon + 1,
            totalShots: player.totalShots + gameState.shotCount,
            successfulShots: player.successfulShots + winnerStats.totalBallsPocketed,
            massWari: player.massWari + winnerStats.massWari,
            totalBallsPocketed: (player.totalBallsPocketed || 0) + winnerStats.totalBallsPocketed,
            totalInnings: (player.totalInnings || 0) + winnerStats.totalInnings
          };
        } else if (player.id === loserId) {
          // 敗者の統計を正しく選択
          const loserStats = player.id === gameSettings.player1.id ? player1FinalStats : player2FinalStats;
            
          return {
            ...player,
            gamesPlayed: player.gamesPlayed + 1,
            totalShots: player.totalShots + gameState.shotCount,
            successfulShots: player.successfulShots + loserStats.totalBallsPocketed,
            massWari: player.massWari + loserStats.massWari,
            totalBallsPocketed: (player.totalBallsPocketed || 0) + loserStats.totalBallsPocketed,
            totalInnings: (player.totalInnings || 0) + loserStats.totalInnings
          };
        }
        return player;
      })
    );
  };

  const calculateStats = (player) => {
    const accuracy = player.totalShots > 0 ? ((player.successfulShots / player.totalShots) * 100).toFixed(1) : '0.0';
    const winRate = player.gamesPlayed > 0 ? ((player.gamesWon / player.gamesPlayed) * 100).toFixed(1) : '0.0';
    const avgScore = player.gamesPlayed > 0 ? (player.successfulShots / player.gamesPlayed).toFixed(1) : '0.0';
    
    // totalBallsPocketed と totalInnings が存在しない場合のフォールバック
    const totalBalls = player.totalBallsPocketed || 0;
    const totalInnings = player.totalInnings || 0;
    const avgInningPocket = totalInnings > 0 ? (totalBalls / totalInnings).toFixed(1) : '0.0';
    
    return { accuracy, winRate, avgScore, avgInningPocket };
  };

  const BallComponent = ({ ballNumber, isOnTable, isDead, isSelected, isDeadSelected, pocketedBy, onClick }) => {
    const isStripe = ballNumber > 8 && ballNumber <= 15;
    const isEightBall = ballNumber === 8;
    
    return (
      <button
        onClick={isOnTable ? onClick : undefined}
        disabled={!isOnTable}
        className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-base transition-all duration-300 relative ${
          isOnTable && !isDead
            ? 'shadow-lg hover:shadow-xl hover:scale-110 cursor-pointer transform border-2 border-white'
            : 'opacity-30 cursor-not-allowed border-2 border-stone-300'
        } ${isDead ? 'border-red-600 border-2' : ''} ${
          isSelected ? 'ring-4 ring-amber-500 ring-offset-2 ring-offset-stone-100 scale-110' : ''
        } ${isDeadSelected ? 'ring-4 ring-red-500 ring-offset-2 ring-offset-stone-100' : ''}`}
        style={{
          backgroundColor: isOnTable && !isDead ? ballColors[ballNumber] : '#e5e5e5'
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
          className={`relative z-10 font-bold ${!isOnTable ? 'text-stone-400' : (isEightBall || ballNumber > 6 ? 'text-white' : 'text-black')}`}
          style={{
            textShadow: (isEightBall || ballNumber > 6) && isOnTable && !isDead ? '0 0 3px rgba(0,0,0,0.8)' : (isOnTable && !isDead && ballNumber <= 6 ? '0 0 3px rgba(255,255,255,0.8)' : 'none')
          }}
        >
          {ballNumber}
        </span>
        {isDead && (
          <div className="absolute -top-1 -right-1 bg-red-600 rounded-full w-5 h-5 flex items-center justify-center border border-white">
            <Skull className="w-3 h-3 text-white" />
          </div>
        )}
        {isSelected && (
          <div className="absolute -top-1 -left-1 bg-amber-500 rounded-full w-5 h-5 flex items-center justify-center border border-white">
            <span className="text-xs font-bold text-white">✓</span>
          </div>
        )}
        {!isOnTable && pocketedBy && (
          <div className={`absolute -bottom-1 -right-1 ${pocketedBy === 1 ? 'bg-amber-600' : 'bg-stone-700'} text-white rounded-full px-2 text-xs font-bold shadow-md border border-white`}>
            P{pocketedBy}
          </div>
        )}
      </button>
    );
  };

  // 広告画面
  if (showAd) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-stone-100 text-stone-800 flex items-center justify-center p-6">
        <div className="max-w-2xl w-full text-center">
          <div className="bg-white shadow-lg rounded-lg p-8 border-2 border-stone-300">
            <h2 className="text-2xl font-serif tracking-wider mb-4 text-stone-800">広告スペース</h2>
            
            {/* 実際の広告を表示する場所 */}
            <div className="bg-stone-100 h-96 rounded-lg flex items-center justify-center mb-6 border-2 border-stone-300">
              <div className="text-center">
                <p className="text-lg font-light text-stone-600 mb-4">
                  ここに広告が表示されます
                </p>
                <p className="text-sm text-stone-500">
                  Google AdSense または他の広告プロバイダーのコードを挿入
                </p>
                {/* 実際の広告コードを挿入する場所 */}
                {/* <div id="ad-container"></div> */}
              </div>
            </div>
            
            <div className="text-center">
              <p className="text-lg font-light text-stone-600 mb-2">
                ゲーム開始まで
              </p>
              <div className="text-5xl font-serif text-amber-600 mb-4">
                {adCountdown}
              </div>
              <button
                onClick={() => {
                  setShowAd(false);
                  initializeGame();
                }}
                className="px-6 py-2 text-sm font-light text-stone-500 hover:text-stone-700 transition-colors"
              >
                スキップ →
              </button>
            </div>
          </div>
          
          <div className="mt-6 text-center">
            <p className="text-xs text-stone-500 font-light">
              広告は当アプリの運営に役立てられます
            </p>
          </div>
        </div>
      </div>
    );
  }

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
                      breakRule: newGameType === 'JCL9ボール' ? 'alternate' : gameSettings.breakRule,
                      threeFoulRule: true // 9ボールとJCL9ボールは3ファウルルールあり
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

            {/* プレイヤー選択 */}
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <label className="block text-xs tracking-[0.2em] text-stone-600 mb-3 font-light">
                  PLAYER 1
                </label>
                <div className="relative">
                  <select
                    value={gameSettings.player1?.id || ''}
                    onChange={(e) => {
                      const player = players.find(p => p.id === parseInt(e.target.value));
                      setGameSettings({...gameSettings, player1: player});
                    }}
                    className="w-full bg-white border border-stone-300 p-4 appearance-none font-light tracking-wider focus:border-amber-600 transition-colors shadow-sm"
                  >
                    <option value="" className="bg-white">Select</option>
                    {players.map(player => (
                      <option key={player.id} value={player.id} className="bg-white">
                        {player.id}.{player.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-stone-600" />
                </div>
              </div>

              <button
                onClick={swapPlayers}
                className="p-4 border-2 border-stone-300 hover:border-amber-600 hover:text-amber-700 bg-white transition-all duration-300 shadow-sm text-stone-700 hover:bg-amber-50 rounded-lg"
                title="プレイヤーを入れ替え"
              >
                <ArrowLeftRight className="w-5 h-5" />
              </button>

              <div className="flex-1">
                <label className="block text-xs tracking-[0.2em] text-stone-600 mb-3 font-light">
                  PLAYER 2
                </label>
                <div className="relative">
                  <select
                    value={gameSettings.player2?.id || ''}
                    onChange={(e) => {
                      const player = players.find(p => p.id === parseInt(e.target.value));
                      setGameSettings({...gameSettings, player2: player});
                    }}
                    className="w-full bg-white border border-stone-300 p-4 appearance-none font-light tracking-wider focus:border-amber-600 transition-colors shadow-sm"
                  >
                    <option value="" className="bg-white">Select</option>
                    {players.map(player => (
                      <option key={player.id} value={player.id} className="bg-white">
                        {player.id}.{player.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-stone-600" />
                </div>
              </div>
            </div>

            {/* ブレイクルール選択 */}
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

            {/* 3ファウルルール選択（9ボール、JCL9ボールのみ） */}
            {(gameSettings.gameType === '9ボール' || gameSettings.gameType === 'JCL9ボール') && (
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

            {/* 目標設定 */}
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <label className="block text-xs tracking-[0.2em] text-stone-600 mb-3 font-light">
                  P1 TARGET {getCurrentRule().targetUnit}
                </label>
                <input
                  type="number"
                  value={gameSettings.player1Target}
                  onChange={(e) => setGameSettings({...gameSettings, player1Target: parseInt(e.target.value)})}
                  className="w-full bg-white border border-stone-300 p-4 font-light tracking-wider focus:border-amber-600 transition-colors text-center shadow-sm"
                  min={gameSettings.isJCL ? "10" : "1"}
                  max={gameSettings.isJCL ? "200" : "10"}
                  step={gameSettings.isJCL ? "5" : "1"}
                />
              </div>

              <button
                onClick={swapTargets}
                className="p-4 border-2 border-stone-300 hover:border-amber-600 hover:text-amber-700 bg-white transition-all duration-300 shadow-sm text-stone-700 hover:bg-amber-50 rounded-lg"
                title="ターゲットを入れ替え"
              >
                <ArrowLeftRight className="w-5 h-5" />
              </button>

              <div className="flex-1">
                <label className="block text-xs tracking-[0.2em] text-stone-600 mb-3 font-light">
                  P2 TARGET {getCurrentRule().targetUnit}
                </label>
                <input
                  type="number"
                  value={gameSettings.player2Target}
                  onChange={(e) => setGameSettings({...gameSettings, player2Target: parseInt(e.target.value)})}
                  className="w-full bg-white border border-stone-300 p-4 font-light tracking-wider focus:border-amber-600 transition-colors text-center shadow-sm"
                  min={gameSettings.isJCL ? "10" : "1"}
                  max={gameSettings.isJCL ? "200" : "10"}
                  step={gameSettings.isJCL ? "5" : "1"}
                />
              </div>
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

  // ゲーム画面
  if (currentScreen === 'game') {
    const currentPlayerName = gameState.currentPlayer === 1 ? gameSettings.player1.name : gameSettings.player2.name;
    const rule = getCurrentRule();
    const ballCount = rule.ballCount;
    const ballsToShow = Array.from({ length: ballCount }, (_, i) => i + 1);
    
    // 各プレイヤーの現在のラックでの落球数を計算
    const player1RackPocketed = Object.values(gameState.pocketedByPlayer).filter(p => p === 1).length;
    const player2RackPocketed = Object.values(gameState.pocketedByPlayer).filter(p => p === 2).length;
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-stone-100 text-stone-800 p-4">
        <div className="max-w-5xl mx-auto">
          <div className="relative mb-6">
            <button
              onClick={() => setCurrentScreen('home')}
              className="absolute left-0 top-0 text-stone-600 hover:text-stone-800 transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h2 className="text-center text-base font-light tracking-[0.2em] text-stone-700">{gameSettings.gameType}</h2>
            <div className="absolute right-0 top-0 text-sm font-light text-stone-500">
              {gameState.startTime}
            </div>
          </div>

          {/* スコア表示 */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className={`border-2 p-4 transition-all duration-300 shadow-md ${gameState.currentPlayer === 1 ? 'border-amber-600 bg-amber-100/50' : 'border-stone-300 bg-white'}`}>
              <div className="text-center">
                <h3 className="font-medium tracking-wider text-base mb-2 text-stone-800">{gameSettings.player1.name}</h3>
                {gameState.player1Fouls > 0 && (
                  <div className="text-sm text-red-600 mb-1">
                    FOUL × {gameState.player1Fouls}
                  </div>
                )}
                <div className="text-4xl font-light mb-1 text-stone-900">{gameState.player1Score}</div>
                <div className="text-sm text-stone-600 font-light">Race to {gameSettings.player1Target}</div>
              </div>
            </div>
            <div className={`border-2 p-4 transition-all duration-300 shadow-md ${gameState.currentPlayer === 2 ? 'border-amber-600 bg-amber-100/50' : 'border-stone-300 bg-white'}`}>
              <div className="text-center">
                <h3 className="font-medium tracking-wider text-base mb-2 text-stone-800">{gameSettings.player2.name}</h3>
                {gameState.player2Fouls > 0 && (
                  <div className="text-sm text-red-600 mb-1">
                    FOUL × {gameState.player2Fouls}
                  </div>
                )}
                <div className="text-4xl font-light mb-1 text-stone-900">{gameState.player2Score}</div>
                <div className="text-sm text-stone-600 font-light">Race to {gameSettings.player2Target}</div>
              </div>
            </div>
          </div>

          {/* ラック・イニング表示 */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-6 text-sm font-light tracking-wider text-stone-700 bg-white px-6 py-2 rounded-full shadow-sm border border-stone-200">
              <span>RACK {gameState.currentRack}</span>
              <span className="w-px h-4 bg-stone-300"></span>
              <span>INNING {Math.max(1, gameState.currentInning)}</span>
              <span className="w-px h-4 bg-stone-300"></span>
              <span className="text-xs text-stone-500">{gameState.breakRule === 'winner' ? '勝者ブレイク' : '交互ブレイク'}</span>
            </div>
            {gameSettings.gameType === 'JCL9ボール' && gameState.isHillHill && (
              <div className="mt-3 p-3 bg-red-100 border-2 border-red-400 text-red-700 text-base font-medium tracking-wide">
                🔥 ヒルヒル！9番を落とした方が勝利！ 🔥
              </div>
            )}
          </div>

          {/* ショット管理表示 */}
          {gameState.shotInProgress && (
            <div className="text-center mb-4">
              <div className="inline-flex items-center gap-4 text-base font-medium tracking-wider text-amber-700 bg-amber-100 px-6 py-2 rounded-full shadow-sm border border-amber-300">
                <span>SHOT MODE</span>
                <span className="text-2xl">{gameState.selectedBallsInShot.length}</span>
              </div>
            </div>
          )}

          {/* ボール表示 */}
          <div className="mb-6">
            {gameState.deadBalls.length > 0 && (
              <div className="text-center mb-3">
                <span className="text-sm font-medium text-red-600 tracking-wider">
                  無効球: {gameState.deadBalls.length}個
                </span>
              </div>
            )}
            <div className={`grid gap-3 ${ballCount === 9 ? 'grid-cols-5' : 'grid-cols-5'}`} style={{ maxWidth: ballCount === 9 ? '380px' : 'none', margin: '0 auto' }}>
              {ballsToShow.map(ballNumber => (
                <BallComponent
                  key={ballNumber}
                  ballNumber={ballNumber}
                  isOnTable={gameState.ballsOnTable.includes(ballNumber)}
                  isDead={gameState.deadBalls.includes(ballNumber)}
                  isSelected={gameState.selectedBallsInShot.includes(ballNumber)}
                  isDeadSelected={gameState.selectedDeadBalls && gameState.selectedDeadBalls.includes(ballNumber)}
                  pocketedBy={gameState.pocketedByPlayer[ballNumber]}
                  onClick={() => pocketBall(ballNumber)}
                />
              ))}
            </div>
          </div>

          {/* 操作ボタン */}
          <div className="space-y-3">
            {/* CHANGEボタン（上部に配置） */}
            <button
              onClick={switchPlayer}
              disabled={gameState.shotInProgress}
              className={`w-full border-2 border-stone-300 hover:border-green-600 hover:text-green-700 py-4 transition-all duration-300 flex items-center justify-center gap-3 bg-white shadow-md text-stone-700 ${
                gameState.shotInProgress ? 'opacity-30' : ''
              }`}
            >
              <RotateCcw className="w-6 h-6" />
              <span className="text-base font-medium tracking-wider">CHANGE PLAYER</span>
            </button>

            {/* 5つのボタングループ */}
            <div className="grid grid-cols-5 gap-2">
            <button
              onClick={undoLastAction}
              disabled={gameState.actionHistory.length === 0}
              className="border-2 border-stone-300 hover:border-amber-600 disabled:border-stone-200 disabled:text-stone-400 p-3 transition-all duration-300 flex flex-col items-center justify-center gap-1 bg-white shadow-sm text-stone-700"
            >
              <Undo className="w-5 h-5" />
              <span className="text-xs font-light">UNDO</span>
              {gameState.actionHistory.length > 0 && (
                <span className="text-xs text-amber-600 font-bold">{gameState.actionHistory.length}</span>
              )}
            </button>

            <button
              onClick={toggleDeadMode}
              disabled={gameState.shotInProgress}
              className={`border-2 p-3 transition-all duration-300 flex flex-col items-center justify-center gap-1 shadow-sm ${
                gameState.deadMode 
                  ? 'border-red-600 bg-red-100 text-red-700' 
                  : 'border-stone-300 hover:border-red-600 hover:text-red-700 bg-white text-stone-700'
              } ${gameState.shotInProgress ? 'opacity-30' : ''}`}
            >
              <Skull className="w-5 h-5" />
              <span className="text-xs font-light">{gameState.deadMode ? 'DONE' : 'DEAD'}</span>
              {gameState.deadMode && gameState.selectedDeadBalls && gameState.selectedDeadBalls.length > 0 && (
                <span className="text-xs text-red-700 font-bold">{gameState.selectedDeadBalls.length}</span>
              )}
            </button>

            <button
              onClick={foul}
              disabled={gameState.shotInProgress}
              className={`border-2 border-stone-300 hover:border-orange-600 hover:text-orange-700 p-3 transition-all duration-300 flex flex-col items-center justify-center gap-1 bg-white shadow-sm text-stone-700 ${
                gameState.shotInProgress ? 'opacity-30' : ''
              }`}
            >
              <AlertCircle className="w-5 h-5" />
              <span className="text-xs font-light">FOUL</span>
            </button>

            <button
              onClick={safety}
              disabled={gameState.shotInProgress}
              className={`border-2 border-stone-300 hover:border-blue-600 hover:text-blue-700 p-3 transition-all duration-300 flex flex-col items-center justify-center gap-1 bg-white shadow-sm text-stone-700 ${
                gameState.shotInProgress ? 'opacity-30' : ''
              }`}
            >
              <Shield className="w-5 h-5" />
              <span className="text-xs font-light">SAFETY</span>
            </button>

            <button
              onClick={toggleShotMode}
              className={`border-2 p-3 transition-all duration-300 flex flex-col items-center justify-center gap-1 shadow-sm ${
                gameState.shotInProgress 
                  ? 'bg-amber-600 text-white hover:bg-amber-700 border-amber-600' 
                  : 'border-stone-300 hover:border-amber-600 hover:text-amber-700 bg-white text-stone-700'
              }`}
            >
              <Play className="w-5 h-5" />
              <span className="text-xs font-light">{gameState.shotInProgress ? 'END' : 'DOUBLE IN'}</span>
            </button>
            </div>
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
              <h2 className="text-3xl font-serif tracking-wider mb-2">プレイヤー記録</h2>
              <div className="w-12 h-px bg-amber-600 mx-auto"></div>
            </div>
          </div>

          <div className="mb-10 text-center">
            <h3 className="text-4xl font-light tracking-wide mb-2 text-stone-900">{selectedPlayer.name}</h3>
            <p className="text-sm font-light tracking-wider text-stone-500">ID.{selectedPlayer.id}</p>
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
                    <span className="text-base text-stone-600">最高連勝</span>
                    <span className="text-xl font-light text-stone-400">—</span>
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
                    <span className="text-base text-stone-600">1ゲーム平均</span>
                    <span className="text-xl font-light text-stone-900">{stats.avgScore}</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-base text-stone-600">1イニング平均</span>
                    <span className="text-xl font-light text-stone-900">{stats.avgInningPocket}</span>
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
                {isJCL && (
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
                {isJCL && (
                  <div className="text-sm text-stone-500 mt-1 font-light">
                    Race to {gameSettings.player2Target}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ゲーム統計 */}
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
                </div>
                <div>
                  <div className="text-stone-600 mb-1 font-light">{gameSettings.player2.name}</div>
                  <div className="font-medium text-stone-800">
                    {gameResult.player2Stats.totalBallsPocketed}球 / {gameResult.totalInnings}イニング
                    {gameResult.player2Stats.massWari > 0 && (
                      <span className="text-purple-700 ml-2">MW: {gameResult.player2Stats.massWari}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

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
                  
