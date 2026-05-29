// Pixel layout source-of-truth for the 1438x1024 stage.
export const LAYOUT = {
  canvas: { w: 1438, h: 1024 },
  reelFrame: { x: 0, y: 0, w: 1438, h: 1024 },
  reelWindow: { x: 145, y: 246, w: 1150, h: 600 },
  grid: {
    cols: 5,
    rows: 3,
    symbolW: 174,
    symbolH: 190,
    startX: 170,
    startY: 250,
    gapX: 58,
    gapY: 10
  },
  spinButton: { x: 629, y: 806, w: 180, h: 180 },
  hud: {
    balance: { x: 265, y: 884, w: 182, h: 62 },
    win: { x: 1070, y: 884, w: 182, h: 62 },
    bet: { x: 562, y: 874, w: 80, h: 62 },
    status: { x: 519, y: 910, w: 399, h: 38 }
  },
  buttons: {
    menu: { x: 72, y: 884, w: 61, h: 60 },
    info: { x: 146, y: 884, w: 61, h: 60 },
    betMinus: { x: 555, y: 883, w: 64, h: 63 },
    betPlus: { x: 811, y: 883, w: 64, h: 63 },
    maxBet: { x: 888, y: 879, w: 80, h: 70 },
    buyBonus: { x: 1166, y: 884, w: 96, h: 58 },
    turbo: { x: 978, y: 883, w: 64, h: 63 },
    sound: { x: 1320, y: 884, w: 61, h: 60 }
  },
  paylineColors: [
    // Reused cyclically when >10 lines win in one round.
    "#ff3b30",
    "#34ff4f",
    "#31a8ff",
    "#ffe234",
    "#ff37dc",
    "#48f2ff",
    "#ff9d20",
    "#9d35ff",
    "#20ffc8",
    "#ffdf4a"
  ]
};

// Symbol texture mapping used by renderSymbolMarkup.
export const SYMBOLS = {
  N1: "a.png",
  N2: "10.png",
  N3: "k.png",
  N4: "cool-capybara.png",
  N5: "ankh-capybara.png",
  N6: "scribe-capybara.png",
  N7: "coin-capybara.png",
  N8: "anubis-capybara.png",
  N9: "vase-capybara.png",
  WILD: "wild.png",
  SCATTER: "scatter.png"
};

// UI button skin mapping and logical action routing.
export const BUTTONS = {
  menu: { file: "menu-btn.png", action: "openMenu" },
  info: { file: "info-btn.png", action: "openPaytable" },
  betMinus: { file: "btn-minus.png", action: "decreaseBet" },
  betPlus: { file: "btn-plus.png", action: "increaseBet" },
  maxBet: { file: "btn-max-bet.png", action: "setMaxBet" },
  buyBonus: { file: "", action: "openBuyBonus" },
  spin: { file: "btn-spin.png", action: "spin" },
  turbo: { file: "btn-turbo.png", action: "toggleTurbo" },
  sound: { file: "btn-sound.png", action: "toggleSound" }
};

export function assetUrl(path) {
  // Works in both dev server and static hosting without hardcoded absolute paths.
  return new URL(`./assets/${path}`, import.meta.url).href;
}
