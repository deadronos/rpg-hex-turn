import { HexfallGame } from "./game.js";

const game = new HexfallGame({
  canvas: document.getElementById("battlefield"),
  battleStatus: document.getElementById("battle-status"),
  turnIndicator: document.getElementById("turn-indicator"),
  turnOrder: document.getElementById("turn-order"),
  selectedUnit: document.getElementById("selected-unit"),
  actionHint: document.getElementById("action-hint"),
  combatLog: document.getElementById("combat-log"),
  moveButton: document.getElementById("move-button"),
  attackButton: document.getElementById("attack-button"),
  specialButton: document.getElementById("special-button"),
  endTurnButton: document.getElementById("end-turn-button"),
  restartButton: document.getElementById("restart-button"),
});

window.hexfallGame = game;
