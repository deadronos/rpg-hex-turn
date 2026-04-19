import { BOARD_RADIUS, createScenario } from "./data.js";
import {
  allBoardHexes,
  axialToPixel,
  hexDistance,
  hexesInRange,
  hexKey,
  hexPolygon,
  neighbors,
  parseHexKey,
  pixelToHex,
  withinBoard,
} from "./hex.js";

const TEAM_COLORS = {
  player: "#5cb7e8",
  enemy: "#d55f4f",
};

export class HexfallGame {
  constructor(elements) {
    this.canvas = elements.canvas;
    this.ctx = this.canvas.getContext("2d");
    this.battleStatus = elements.battleStatus;
    this.turnIndicator = elements.turnIndicator;
    this.turnOrder = elements.turnOrder;
    this.selectedUnit = elements.selectedUnit;
    this.actionHint = elements.actionHint;
    this.combatLog = elements.combatLog;
    this.moveButton = elements.moveButton;
    this.attackButton = elements.attackButton;
    this.specialButton = elements.specialButton;
    this.endTurnButton = elements.endTurnButton;
    this.restartButton = elements.restartButton;

    this.boardHexes = allBoardHexes(BOARD_RADIUS);
    this.resizeObserver = new ResizeObserver(() => this.resizeCanvas());
    this.resizeObserver.observe(this.canvas);

    this.canvas.addEventListener("mousemove", (event) =>
      this.handlePointerMove(event),
    );
    this.canvas.addEventListener("mouseleave", () => {
      this.hoveredHexKey = null;
      this.render();
    });
    this.canvas.addEventListener("click", (event) => this.handleCanvasClick(event));

    this.moveButton.addEventListener("click", () => this.selectMode("move"));
    this.attackButton.addEventListener("click", () => this.selectMode("attack"));
    this.specialButton.addEventListener("click", () => this.handleSpecialButton());
    this.endTurnButton.addEventListener("click", () => this.endTurn());
    this.restartButton.addEventListener("click", () => this.reset());

    this.reset();
  }

  reset() {
    if (this.enemyTimer) {
      clearTimeout(this.enemyTimer);
    }

    const scenario = createScenario();
    this.units = scenario.units;
    this.terrain = scenario.terrain;
    this.round = 1;
    this.queue = [];
    this.currentUnitId = null;
    this.selectedId = null;
    this.mode = "move";
    this.pendingMessage = "";
    this.hoveredHexKey = null;
    this.winner = null;
    this.logEntries = [
      "Heroes advance into the ruin. Defeat every enemy before the party falls.",
    ];

    this.resizeCanvas();
    this.startNextTurn(true);
  }

  resizeCanvas() {
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(640, Math.floor(rect.width || 960));
    const height = Math.max(500, Math.floor(rect.height || 720));
    const pixelRatio = window.devicePixelRatio || 1;

    this.canvas.width = Math.floor(width * pixelRatio);
    this.canvas.height = Math.floor(height * pixelRatio);
    this.ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    this.viewport = { width, height };
    this.layout = {
      size: Math.min(width / 16.6, height / 14.5),
      originX: width / 2,
      originY: height / 2 + 8,
    };

    this.render();
  }

  getLivingUnits(team = null) {
    return this.units.filter((unit) => unit.hp > 0 && (!team || unit.team === team));
  }

  getUnitById(id) {
    return this.units.find((unit) => unit.id === id) ?? null;
  }

  getCurrentUnit() {
    return this.getUnitById(this.currentUnitId);
  }

  startNextTurn(isFreshBattle = false) {
    if (this.winner) {
      this.render();
      return;
    }

    if (this.checkWinner()) {
      this.render();
      return;
    }

    while (true) {
      if (this.queue.length === 0) {
        this.queue = this.getLivingUnits()
          .sort((left, right) => right.initiative - left.initiative)
          .map((unit) => unit.id);

        if (!isFreshBattle) {
          this.round += 1;
          this.addLog(`Round ${this.round} begins.`);
        }
      }

      this.currentUnitId = this.queue.shift();
      const unit = this.getUnitById(this.currentUnitId);
      if (!unit || unit.hp <= 0) {
        continue;
      }

      unit.hasMoved = false;
      unit.hasActed = false;
      unit.specialCooldown = Math.max(0, unit.specialCooldown - 1);
      this.selectedId = unit.id;
      this.mode = unit.team === "player" ? "move" : "enemy";
      this.pendingMessage = unit.team === "player"
        ? "Select a reachable hex or choose an action."
        : `${unit.name} is plotting a move.`;
      this.render();

      if (unit.team === "enemy") {
        this.enemyTimer = window.setTimeout(() => this.runEnemyTurn(unit.id), 520);
      }
      break;
    }
  }

  selectMode(mode) {
    const unit = this.getCurrentUnit();
    if (!unit || unit.team !== "player" || this.winner) {
      return;
    }

    if (mode === "move" && unit.hasMoved) {
      return;
    }

    if ((mode === "attack" || mode === "special") && unit.hasActed) {
      return;
    }

    this.mode = mode;
    this.pendingMessage = this.getModeHint(unit, mode);
    this.render();
  }

  handleSpecialButton() {
    const unit = this.getCurrentUnit();
    if (!unit || unit.team !== "player" || unit.hasActed || this.winner) {
      return;
    }

    if (unit.specialCooldown > 0) {
      this.pendingMessage = `${unit.special.name} is recharging for ${unit.specialCooldown} turn(s).`;
      this.render();
      return;
    }

    if (unit.type === "warrior") {
      this.useWarriorSpecial(unit);
      return;
    }

    this.mode = "special";
    this.pendingMessage = this.getModeHint(unit, "special");
    this.render();
  }

  handlePointerMove(event) {
    const hex = this.eventToHex(event);
    const key = hex ? hexKey(hex) : null;
    if (key !== this.hoveredHexKey) {
      this.hoveredHexKey = key;
      this.render();
    }
  }

  handleCanvasClick(event) {
    const unit = this.getCurrentUnit();
    if (!unit || unit.team !== "player" || this.winner) {
      return;
    }

    const hex = this.eventToHex(event);
    if (!hex) {
      return;
    }

    const key = hexKey(hex);

    if (this.mode === "move") {
      const reachable = this.getReachableHexes(unit);
      if (reachable.has(key)) {
        this.moveUnit(unit, hex);
        unit.hasMoved = true;
        this.pendingMessage = unit.hasActed
          ? "Movement spent. Ending turn."
          : "Movement spent. Choose Attack, Special, or End Turn.";
        if (unit.hasActed) {
          this.finishPlayerAction();
        } else {
          this.render();
        }
        return;
      }
    }

    if (this.mode === "attack") {
      const target = this.getUnitAt(key);
      if (target && target.team !== unit.team && this.canAttack(unit, target)) {
        this.performBasicAttack(unit, target);
        return;
      }
    }

    if (this.mode === "special") {
      if (unit.type === "rogue") {
        this.useRogueSpecial(unit, hex);
        return;
      }
      if (unit.type === "mage") {
        this.useMageSpecial(unit, hex);
      }
    }
  }

  eventToHex(event) {
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const hex = pixelToHex(
      x,
      y,
      this.layout.size,
      this.layout.originX,
      this.layout.originY,
    );
    return withinBoard(hex, BOARD_RADIUS) ? hex : null;
  }

  getModeHint(unit, mode) {
    if (mode === "move") {
      return "Select an empty highlighted hex within movement range.";
    }
    if (mode === "attack") {
      return `Select an enemy within ${unit.attackRange} hex${
        unit.attackRange > 1 ? "es" : ""
      }.`;
    }
    if (mode === "special" && unit.type === "rogue") {
      return "Select an empty hex within 3 to teleport and strike from the shadows.";
    }
    if (mode === "special" && unit.type === "mage") {
      return "Select a hex within 3 to detonate a fireball burst.";
    }
    return "";
  }

  getUnitAt(key) {
    return this.units.find((unit) => unit.hp > 0 && hexKey(unit) === key) ?? null;
  }

  isBlocked(hex) {
    return this.terrain.has(hexKey(hex));
  }

  isOccupied(hex, ignoreUnitId = null) {
    return this.units.some(
      (unit) =>
        unit.hp > 0 &&
        unit.id !== ignoreUnitId &&
        unit.q === hex.q &&
        unit.r === hex.r,
    );
  }

  getReachableHexes(unit, rangeOverride = null) {
    const maxSteps = rangeOverride ?? unit.move;
    const start = { q: unit.q, r: unit.r };
    const frontier = [{ hex: start, steps: 0 }];
    const visited = new Map([[hexKey(start), 0]]);

    while (frontier.length > 0) {
      const current = frontier.shift();
      for (const next of neighbors(current.hex)) {
        if (!withinBoard(next, BOARD_RADIUS) || this.isBlocked(next)) {
          continue;
        }

        const nextKey = hexKey(next);
        if (visited.has(nextKey)) {
          continue;
        }

        const nextSteps = current.steps + 1;
        if (nextSteps > maxSteps) {
          continue;
        }

        if (this.isOccupied(next, unit.id)) {
          continue;
        }

        visited.set(nextKey, nextSteps);
        frontier.push({ hex: next, steps: nextSteps });
      }
    }

    visited.delete(hexKey(start));
    return visited;
  }

  canAttack(attacker, target) {
    return hexDistance(attacker, target) <= attacker.attackRange;
  }

  addLog(message) {
    this.logEntries.unshift(message);
    this.logEntries = this.logEntries.slice(0, 18);
  }

  moveUnit(unit, destination) {
    const fromKey = hexKey(unit);
    unit.q = destination.q;
    unit.r = destination.r;
    const toKey = hexKey(destination);
    this.addLog(`${unit.name} moves from ${fromKey} to ${toKey}.`);
  }

  calculateDamage(baseDamage, target, armorPiercing = 0) {
    return Math.max(1, baseDamage - Math.max(0, target.armor - armorPiercing));
  }

  damageUnit(source, target, baseDamage, label, armorPiercing = 0) {
    const damage = this.calculateDamage(baseDamage, target, armorPiercing);
    target.hp = Math.max(0, target.hp - damage);
    this.addLog(`${source.name} uses ${label} on ${target.name} for ${damage} damage.`);
    if (target.hp <= 0) {
      this.addLog(`${target.name} falls.`);
    }
  }

  performBasicAttack(attacker, target) {
    let damage = attacker.attack;
    if (attacker.type === "rogue") {
      const adjacentAllies = neighbors(target)
        .map((hex) => this.getUnitAt(hexKey(hex)))
        .filter(
          (unit) =>
            unit &&
            unit.team === attacker.team &&
            unit.id !== attacker.id &&
            unit.hp > 0,
        );
      if (adjacentAllies.length > 0) {
        damage += 1;
      }
    }

    this.damageUnit(attacker, target, damage, attacker.attackLabel);
    attacker.hasActed = true;
    this.pendingMessage = attacker.hasMoved
      ? "Attack spent. Ending turn."
      : "Attack spent. You may still move or end the turn.";
    this.finishPlayerAction();
  }

  useWarriorSpecial(unit) {
    if (unit.specialCooldown > 0) {
      return;
    }

    const targets = neighbors(unit)
      .map((hex) => this.getUnitAt(hexKey(hex)))
      .filter((target) => target && target.team !== unit.team);

    if (targets.length === 0) {
      this.pendingMessage = "Cleave needs at least one adjacent enemy.";
      this.render();
      return;
    }

    for (const target of targets) {
      this.damageUnit(unit, target, 4, unit.special.name, 1);
    }

    unit.hasActed = true;
    unit.specialCooldown = unit.special.cooldown;
    this.pendingMessage = unit.hasMoved
      ? "Cleave spent. Ending turn."
      : "Cleave spent. Move if needed or end the turn.";
    this.finishPlayerAction();
  }

  useRogueSpecial(unit, destination) {
    const destinationKey = hexKey(destination);
    const reachable = this.getReachableHexes(unit, 3);
    if (!reachable.has(destinationKey) || this.isBlocked(destination) || this.isOccupied(destination, unit.id)) {
      this.pendingMessage = "Shadowstep needs an empty destination within 3 hexes.";
      this.render();
      return;
    }

    this.moveUnit(unit, destination);
    const adjacentEnemies = neighbors(unit)
      .map((hex) => this.getUnitAt(hexKey(hex)))
      .filter((target) => target && target.team !== unit.team);

    if (adjacentEnemies.length > 0) {
      adjacentEnemies.sort((left, right) => left.hp - right.hp);
      this.damageUnit(unit, adjacentEnemies[0], 4, unit.special.name, 1);
    } else {
      this.addLog(`${unit.name} vanishes into the shadows and reappears unharmed.`);
    }

    unit.hasMoved = true;
    unit.hasActed = true;
    unit.specialCooldown = unit.special.cooldown;
    this.pendingMessage = "Shadowstep spent. Ending turn.";
    this.finishPlayerAction();
  }

  useMageSpecial(unit, targetHex) {
    if (hexDistance(unit, targetHex) > 3) {
      this.pendingMessage = "Fireball targets must be within 3 hexes.";
      this.render();
      return;
    }

    const impactedEnemies = hexesInRange(targetHex, 1)
      .map((hex) => this.getUnitAt(hexKey(hex)))
      .filter((target) => target && target.team !== unit.team);

    if (impactedEnemies.length === 0) {
      this.pendingMessage = "Fireball needs at least one enemy in the blast zone.";
      this.render();
      return;
    }

    impactedEnemies.forEach((target) => {
      this.damageUnit(unit, target, 3, unit.special.name);
    });

    unit.hasActed = true;
    unit.specialCooldown = unit.special.cooldown;
    this.pendingMessage = unit.hasMoved
      ? "Fireball spent. Ending turn."
      : "Fireball spent. You may still move or end the turn.";
    this.finishPlayerAction();
  }

  finishPlayerAction() {
    if (this.checkWinner()) {
      this.render();
      return;
    }

    const unit = this.getCurrentUnit();
    if (!unit) {
      return;
    }

    if (unit.hasMoved && unit.hasActed) {
      this.render();
      window.setTimeout(() => this.endTurn(), 260);
      return;
    }

    if (unit.hasActed && !unit.hasMoved) {
      this.mode = "move";
    } else if (unit.hasMoved && !unit.hasActed) {
      this.mode = "attack";
    }

    this.render();
  }

  endTurn() {
    if (this.winner) {
      return;
    }

    const unit = this.getCurrentUnit();
    if (!unit) {
      return;
    }

    if (unit.team === "player") {
      this.pendingMessage = "";
    }
    this.startNextTurn();
  }

  checkWinner() {
    if (this.winner) {
      return this.winner;
    }

    const livingPlayers = this.getLivingUnits("player");
    const livingEnemies = this.getLivingUnits("enemy");

    if (livingPlayers.length === 0) {
      this.winner = "enemy";
      this.pendingMessage = "The party is defeated. Restart to try again.";
      this.addLog("The heroes fall. The ruin belongs to the monsters.");
      return this.winner;
    }

    if (livingEnemies.length === 0) {
      this.winner = "player";
      this.pendingMessage = "Victory. The battlefield is clear.";
      this.addLog("Every foe is down. The heroes claim the ruin.");
      return this.winner;
    }

    return null;
  }

  runEnemyTurn(unitId) {
    const unit = this.getUnitById(unitId);
    if (!unit || unit.hp <= 0 || this.currentUnitId !== unitId || this.winner) {
      return;
    }

    if (unit.type === "goblin") {
      this.runGoblinTurn(unit);
    } else if (unit.type === "orc") {
      this.runOrcTurn(unit);
    } else {
      this.runSkeletonTurn(unit);
    }

    this.checkWinner();
    this.render();
    if (!this.winner) {
      this.enemyTimer = window.setTimeout(() => this.startNextTurn(), 560);
    }
  }

  runGoblinTurn(unit) {
    const heroes = this.getLivingUnits("player");
    heroes.sort((left, right) => {
      if (left.hp !== right.hp) {
        return left.hp - right.hp;
      }
      return hexDistance(unit, left) - hexDistance(unit, right);
    });
    const targetHero = heroes[0];

    const adjacentTargets = heroes.filter((hero) => hexDistance(unit, hero) === 1);
    if (adjacentTargets.length > 0) {
      this.damageUnit(unit, adjacentTargets[0], unit.attack, unit.attackLabel);
      return;
    }

    const destination = this.chooseBestMove(unit, (hex) => {
      const nearestTarget = Math.min(...heroes.map((hero) => hexDistance(hex, hero)));
      const support = neighbors(hex)
        .map((neighbor) => this.getUnitAt(hexKey(neighbor)))
        .filter((ally) => ally && ally.team === unit.team && ally.id !== unit.id).length;
      const weakTargetPressure = 8 - hexDistance(hex, targetHero);
      return weakTargetPressure * 10 + support * 2 - nearestTarget;
    });

    if (destination) {
      this.moveUnit(unit, destination);
    }

    const targetsAfterMove = this.getLivingUnits("player").filter(
      (hero) => hexDistance(unit, hero) === 1,
    );
    if (targetsAfterMove.length > 0) {
      targetsAfterMove.sort((left, right) => left.hp - right.hp);
      this.damageUnit(unit, targetsAfterMove[0], unit.attack, unit.attackLabel);
    } else {
      this.addLog(`${unit.name} hisses and looks for an opening.`);
    }
  }

  runOrcTurn(unit) {
    const heroes = this.getLivingUnits("player");
    const adjacentHeroes = heroes.filter((hero) => hexDistance(unit, hero) === 1);
    if (adjacentHeroes.length >= 2) {
      adjacentHeroes.forEach((hero) => {
        this.damageUnit(unit, hero, 4, unit.special.name);
      });
      return;
    }
    if (adjacentHeroes.length === 1) {
      this.damageUnit(unit, adjacentHeroes[0], unit.attack, unit.attackLabel);
      return;
    }

    const destination = this.chooseBestMove(unit, (hex) => {
      const contactCount = heroes.filter((hero) => hexDistance(hex, hero) === 1).length;
      const nearest = Math.min(...heroes.map((hero) => hexDistance(hex, hero)));
      return contactCount * 30 - nearest * 4;
    });

    if (destination) {
      this.moveUnit(unit, destination);
    }

    const afterMoveAdjacent = this.getLivingUnits("player").filter(
      (hero) => hexDistance(unit, hero) === 1,
    );
    if (afterMoveAdjacent.length >= 2) {
      afterMoveAdjacent.forEach((hero) => {
        this.damageUnit(unit, hero, 4, unit.special.name);
      });
    } else if (afterMoveAdjacent.length === 1) {
      this.damageUnit(unit, afterMoveAdjacent[0], unit.attack, unit.attackLabel);
    } else {
      this.addLog(`${unit.name} roars across the stones.`);
    }
  }

  runSkeletonTurn(unit) {
    const heroes = this.getLivingUnits("player");
    const adjacentHeroes = heroes.filter((hero) => hexDistance(unit, hero) === 1);

    if (adjacentHeroes.length > 0) {
      const retreat = this.chooseBestMove(unit, (hex) => {
        const nearest = Math.min(...heroes.map((hero) => hexDistance(hex, hero)));
        const attackable = heroes.some((hero) => {
          const distance = hexDistance(hex, hero);
          return distance >= 2 && distance <= unit.attackRange;
        });
        return nearest * 8 + (attackable ? 6 : 0);
      });
      if (retreat) {
        this.moveUnit(unit, retreat);
      }
    }

    const rangedTargets = this.getLivingUnits("player").filter((hero) => {
      const distance = hexDistance(unit, hero);
      return distance >= 1 && distance <= unit.attackRange;
    });

    if (rangedTargets.length > 0) {
      rangedTargets.sort((left, right) => {
        if (left.hp !== right.hp) {
          return left.hp - right.hp;
        }
        return hexDistance(unit, left) - hexDistance(unit, right);
      });
      this.damageUnit(unit, rangedTargets[0], unit.attack, unit.attackLabel);
      return;
    }

    const advance = this.chooseBestMove(unit, (hex) => {
      const distances = heroes.map((hero) => hexDistance(hex, hero));
      const nearest = Math.min(...distances);
      const preferredBand = distances.some((distance) => distance >= 2 && distance <= 3);
      return (preferredBand ? 20 : 0) + nearest * 2;
    });

    if (advance) {
      this.moveUnit(unit, advance);
    }

    const attackTargets = this.getLivingUnits("player").filter((hero) => {
      const distance = hexDistance(unit, hero);
      return distance >= 1 && distance <= unit.attackRange;
    });
    if (attackTargets.length > 0) {
      attackTargets.sort((left, right) => left.hp - right.hp);
      this.damageUnit(unit, attackTargets[0], unit.attack, unit.attackLabel);
    } else {
      this.addLog(`${unit.name} rattles in search of a firing lane.`);
    }
  }

  chooseBestMove(unit, scorer) {
    const reachable = this.getReachableHexes(unit);
    const options = Array.from(reachable.keys()).map((key) => parseHexKey(key));
    if (options.length === 0) {
      return null;
    }

    let bestHex = null;
    let bestScore = -Infinity;
    for (const option of options) {
      const score = scorer(option);
      if (score > bestScore) {
        bestScore = score;
        bestHex = option;
      }
    }
    return bestHex;
  }

  getHighlights() {
    const current = this.getCurrentUnit();
    if (!current || current.team !== "player" || this.winner) {
      return {
        move: new Set(),
        attack: new Set(),
        special: new Set(),
      };
    }

    const move = new Set();
    const attack = new Set();
    const special = new Set();

    if (!current.hasMoved) {
      for (const key of this.getReachableHexes(current).keys()) {
        move.add(key);
      }
    }

    if (!current.hasActed) {
      for (const target of this.getLivingUnits(current.team === "player" ? "enemy" : "player")) {
        if (this.canAttack(current, target)) {
          attack.add(hexKey(target));
        }
      }

      if (current.specialCooldown === 0) {
        if (current.type === "rogue") {
          for (const key of this.getReachableHexes(current, 3).keys()) {
            special.add(key);
          }
        } else if (current.type === "mage") {
          for (const hex of this.boardHexes) {
            if (hexDistance(current, hex) <= 3) {
              special.add(hexKey(hex));
            }
          }
        } else if (current.type === "warrior") {
          special.add(hexKey(current));
        }
      }
    }

    return { move, attack, special };
  }

  drawHex(center, fill, stroke, lineWidth = 2) {
    const points = hexPolygon(center.x, center.y, this.layout.size - 2);
    this.ctx.beginPath();
    this.ctx.moveTo(points[0].x, points[0].y);
    for (const point of points.slice(1)) {
      this.ctx.lineTo(point.x, point.y);
    }
    this.ctx.closePath();
    this.ctx.fillStyle = fill;
    this.ctx.fill();
    this.ctx.lineWidth = lineWidth;
    this.ctx.strokeStyle = stroke;
    this.ctx.stroke();
  }

  render() {
    if (!this.viewport) {
      return;
    }

    const { ctx } = this;
    const { width, height } = this.viewport;
    ctx.clearRect(0, 0, width, height);

    const highlights = this.getHighlights();
    const hovered = this.hoveredHexKey;
    const current = this.getCurrentUnit();

    for (const hex of this.boardHexes) {
      const center = axialToPixel(
        hex,
        this.layout.size,
        this.layout.originX,
        this.layout.originY,
      );
      const key = hexKey(hex);
      const terrain = this.terrain.get(key);

      let fill = terrain ? "#4f463d" : "#2a4437";
      let stroke = terrain ? "#93806f" : "#4a725f";

      if (!terrain && (hex.q + hex.r) % 2 === 0) {
        fill = "#325340";
      }

      if (highlights.move.has(key) && this.mode === "move") {
        fill = "#26594e";
        stroke = "#6fd7bd";
      }

      if (highlights.attack.has(key) && this.mode === "attack") {
        fill = "#593229";
        stroke = "#ef8f6d";
      }

      if (highlights.special.has(key) && this.mode === "special") {
        fill = "#5a5030";
        stroke = "#e8d26a";
      }

      if (key === hovered) {
        stroke = "#f8e2aa";
      }

      this.drawHex(center, fill, stroke);

      if (terrain) {
        ctx.fillStyle = "#c8ad8d";
        ctx.fillRect(center.x - 10, center.y - 10, 20, 20);
        ctx.fillStyle = "#6a5644";
        ctx.fillRect(center.x - 6, center.y - 16, 12, 12);
      }
    }

    for (const unit of this.units.filter((entry) => entry.hp > 0)) {
      this.drawUnit(unit, current && current.id === unit.id);
    }

    if (this.winner) {
      ctx.fillStyle = "rgba(6, 9, 11, 0.56)";
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "#f4ddb0";
      ctx.font = '700 34px "Trebuchet MS", sans-serif';
      ctx.textAlign = "center";
      ctx.fillText(
        this.winner === "player" ? "Victory" : "Defeat",
        width / 2,
        height / 2 - 8,
      );
      ctx.font = '18px "Trebuchet MS", sans-serif';
      ctx.fillStyle = "#d4c8a8";
      ctx.fillText("Press Restart Battle to play again.", width / 2, height / 2 + 28);
    }

    this.renderPanels();
  }

  drawUnit(unit, isCurrent) {
    const center = axialToPixel(
      unit,
      this.layout.size,
      this.layout.originX,
      this.layout.originY,
    );
    const radius = this.layout.size * 0.48;
    const ctx = this.ctx;

    if (isCurrent) {
      ctx.beginPath();
      ctx.arc(center.x, center.y, radius + 7, 0, Math.PI * 2);
      ctx.strokeStyle = "#f3d176";
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    ctx.fillStyle = unit.palette.base;
    ctx.fillRect(center.x - radius * 0.62, center.y - radius * 0.62, radius * 1.24, radius * 1.24);
    ctx.fillStyle = unit.palette.detail;
    ctx.fillRect(center.x - radius * 0.36, center.y - radius * 0.74, radius * 0.72, radius * 0.52);
    ctx.fillStyle = unit.palette.trim;
    ctx.fillRect(center.x - radius * 0.7, center.y + radius * 0.28, radius * 1.4, 5);

    if (unit.type === "mage") {
      ctx.fillStyle = "#ffd776";
      ctx.beginPath();
      ctx.arc(center.x + 10, center.y - 2, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (unit.type === "rogue") {
      ctx.fillStyle = "#12231f";
      ctx.fillRect(center.x + 8, center.y - 16, 4, 24);
    } else if (unit.type === "skeleton") {
      ctx.fillStyle = "#7a6b52";
      ctx.fillRect(center.x + 10, center.y - 18, 4, 28);
    } else if (unit.type === "warrior") {
      ctx.fillStyle = "#d8d1bf";
      ctx.fillRect(center.x - 16, center.y - 20, 6, 28);
    }

    const healthRatio = unit.hp / unit.maxHp;
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(center.x - radius, center.y - radius - 14, radius * 2, 6);
    ctx.fillStyle = unit.team === "player" ? TEAM_COLORS.player : TEAM_COLORS.enemy;
    ctx.fillRect(center.x - radius, center.y - radius - 14, radius * 2 * healthRatio, 6);

    ctx.fillStyle = "#f9efcf";
    ctx.font = 'bold 12px "Courier New", monospace';
    ctx.textAlign = "center";
    ctx.fillText(unit.hp.toString(), center.x, center.y + 4);
  }

  renderPanels() {
    const current = this.getCurrentUnit();
    const turnLabel = current
      ? `${current.name} (${current.role})`
      : this.winner === "player"
        ? "Heroes victorious"
        : "Battle ended";

    this.battleStatus.textContent = this.winner
      ? this.winner === "player"
        ? "The ruin is yours"
        : "The heroes have fallen"
      : "Hold the line on the shattered hexes";
    this.turnIndicator.textContent = this.winner
      ? this.pendingMessage
      : `Round ${this.round} • ${turnLabel}`;

    const queueUnits = [
      ...(current ? [current] : []),
      ...this.queue
        .map((id) => this.getUnitById(id))
        .filter((unit) => unit && unit.hp > 0),
    ];

    this.turnOrder.innerHTML = queueUnits
      .slice(0, 7)
      .map(
        (unit, index) => `
          <article class="turn-card ${index === 0 && !this.winner ? "active" : ""}">
            <div class="turn-card-header">
              <strong>${unit.name}</strong>
              <span class="chip ${unit.team}">${unit.role}</span>
            </div>
            <p class="unit-copy">HP ${unit.hp}/${unit.maxHp} • Move ${unit.move} • Range ${unit.attackRange}</p>
          </article>
        `,
      )
      .join("");

    if (queueUnits.length === 0) {
      this.turnOrder.innerHTML = '<p class="empty-state">No units remain in the queue.</p>';
    }

    const selected = current || this.getUnitById(this.selectedId);
    this.selectedUnit.innerHTML = selected
      ? `
        <article class="unit-card">
          <div class="unit-card-header">
            <strong>${selected.name}</strong>
            <span class="chip ${selected.team}">${selected.role}</span>
          </div>
          <div class="stats-grid">
            <span>HP ${selected.hp}/${selected.maxHp}</span>
            <span>Armor ${selected.armor}</span>
            <span>Move ${selected.move}</span>
            <span>Range ${selected.attackRange}</span>
            <span>Attack ${selected.attack}</span>
            <span>Initiative ${selected.initiative}</span>
          </div>
          <p class="ability-copy"><strong>${selected.special.name}:</strong> ${selected.special.description}</p>
          <p class="unit-copy">Special cooldown: ${selected.specialCooldown} turn(s).</p>
        </article>
      `
      : '<p class="empty-state">Select a unit on your turn.</p>';

    this.actionHint.textContent = this.pendingMessage;
    this.combatLog.innerHTML = this.logEntries
      .map((entry) => `<div class="log-entry">${entry}</div>`)
      .join("");

    const playerTurn = current && current.team === "player" && !this.winner;
    this.moveButton.disabled = !playerTurn || current.hasMoved;
    this.attackButton.disabled = !playerTurn || current.hasActed;
    this.specialButton.disabled =
      !playerTurn || current.hasActed || current.specialCooldown > 0;
    this.endTurnButton.disabled = !playerTurn;

    const activeButton = {
      move: this.moveButton,
      attack: this.attackButton,
      special: this.specialButton,
    }[this.mode];

    [this.moveButton, this.attackButton, this.specialButton].forEach((button) =>
      button.classList.remove("active"),
    );
    if (activeButton && playerTurn) {
      activeButton.classList.add("active");
    }
  }
}
