import { GAME_CONFIG } from "./config.js";
import { BUTTONS, LAYOUT, SYMBOLS, assetUrl } from "./layout.js";

// API endpoint is injected at deploy time; localhost is dev fallback.
const API_BASE_URL = normalizeApiBaseUrl( window.__GAME_API_URL__ ) ?? "http://localhost:3000";
let session = null;
let currentState = "IDLE";
let lastRound = null;
let spinCounter = 0;
let currentScreen = emptyScreen();
let displayedBalance = 0;
let displayedWin = 0;
let freeSpinsRemaining = 0;
let bonusAwardedSpins = 0;
let bonusTotalWin = 0;
let bonusHudActive = false;
let turboEnabled = false;
let soundEnabled = false;
let audioReady = false;
let serverBetOptions = null;
let activeCelebrationSkip = null;
let queuedSpinAfterWin = false;
let buyBonusBetIndex = 0;
const reelWheelSounds = Array.from( { length: GAME_CONFIG.reels }, () =>
{
  const audio = new Audio( assetUrl( "sounds/wheel.mp3" ) );
  audio.loop = true;
  audio.preload = "auto";
  return audio;
} );

// Centralized timings for normal vs turbo reel flow and win presentation.
const SPIN_TIMINGS = {
  normal: {
    reelTickMs: 54,
    teaseTickMs: 150,
    reelStopBaseMs: 230,
    reelStopStepMs: 115,
    teaseStopBaseMs: 1450,
    teaseStopStepMs: 420,
    settleMs: 180,
    paylineMs: 760,
    smallWinMs: 280,
    bonusIntroDelayMs: 700,
    winMs: 5000,
    bigWinMs: 5000,
    exitMs: 260,
    freeSpinGapMs: 360
  },
  turbo: {
    reelTickMs: 34,
    teaseTickMs: 90,
    reelStopBaseMs: 80,
    reelStopStepMs: 45,
    teaseStopBaseMs: 620,
    teaseStopStepMs: 180,
    settleMs: 70,
    paylineMs: 320,
    smallWinMs: 100,
    bonusIntroDelayMs: 320,
    winMs: 5000,
    bigWinMs: 5000,
    exitMs: 160,
    freeSpinGapMs: 120
  }
};

const els = {
  viewport: document.querySelector( "#stageViewport" ),
  stage: document.querySelector( "#gameStage" ),
  reelsFrame: document.querySelector( "#reelsFrame" ),
  reels: document.querySelector( "#reels" ),
  paylineLayer: document.querySelector( "#paylineLayer" ),
  paylineLabels: document.querySelector( "#paylineLabels" ),
  assetLoader: document.querySelector( "#assetLoader" ),
  assetLoaderProgress: document.querySelector( "#assetLoaderProgress" ),
  winCelebration: document.querySelector( "#winCelebration" ),
  winCelebrationImage: document.querySelector( "#winCelebrationImage" ),
  winCelebrationAmount: document.querySelector( "#winCelebrationAmount" ),
  bonusIntro: document.querySelector( "#bonusIntro" ),
  bonusIntroButton: document.querySelector( "#bonusIntroButton" ),
  balance: document.querySelector( "#balance" ),
  roundState: document.querySelector( "#roundState" ),
  bonusState: document.querySelector( "#bonusState" ),
  lastWin: document.querySelector( "#lastWin" ),
  betSelect: document.querySelector( "#betSelect" ),
  stageButtons: document.querySelector( "#stageButtons" ),
  bgMusic: document.querySelector( "#bgMusic" ),
  wildSound: document.querySelector( "#wildSound" ),
  bonusSound: document.querySelector( "#bonusSound" ),
  volumeControl: document.querySelector( "#volumeControl" ),
  volumeSlider: document.querySelector( "#volumeSlider" ),
  buyBonusModal: document.querySelector( "#buyBonusModal" ),
  closeBuyBonus: document.querySelector( "#closeBuyBonus" ),
  buyBonusMinus: document.querySelector( "#buyBonusMinus" ),
  buyBonusPlus: document.querySelector( "#buyBonusPlus" ),
  buyBonusBet: document.querySelector( "#buyBonusBet" ),
  buyBonusCost: document.querySelector( "#buyBonusCost" ),
  confirmBuyBonus: document.querySelector( "#confirmBuyBonus" ),
  scatterTeaseBanner: document.querySelector( "#scatterTeaseBanner" ),
  paytablePanel: document.querySelector( "#paytablePanel" ),
  auditPanel: document.querySelector( "#auditPanel" ),
  closePaytable: document.querySelector( "#closePaytable" ),
  closeAudit: document.querySelector( "#closeAudit" ),
  paytable: document.querySelector( "#paytable" ),
  auditLog: document.querySelector( "#auditLog" )
};

setup().catch( showError );

function onGlobalKeyDown ( event )
{
  // Spacebar acts as keyboard spin shortcut.
  if ( event.code !== "Space" ) return;

  // Prevent page scroll side-effects when pressing Space.
  event.preventDefault();

  // Ignore while user is editing form fields.
  const tag = document.activeElement?.tagName;
  if ( tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" ) return;
  // Ignore while overlays are open.
  if ( !els.paytablePanel.hidden || !els.auditPanel.hidden ) return;

  // Ignore only while reels/API are busy. During win presentation Space skips and queues next spin.
  if ( currentState === "SPINNING" || currentState === "SPIN_REQUESTED" ) return;

  spin();
}


async function setup ()
{
  // Bind UI before network work so overlays remain usable if /init is slow.
  setupLayout();
  renderButtons();
  clearPaylineLabels();
  renderScreen( emptyScreen() );
  setSpinDisabled( true );
  bindUiEvents();
  setupAudio();
  await preloadAssets();
  await initSession();
  renderBetOptions();
  renderPaytable();
  currentState = "BETTING";
  updateHud();
  setSpinDisabled( false );
}

function bindUiEvents ()
{
  document.addEventListener( "keydown", onGlobalKeyDown );
  document.addEventListener( "visibilitychange", handleVisibilityChange );
  els.betSelect.addEventListener( "change", () => renderPaytable() );
  els.volumeSlider.addEventListener( "input", updateMusicVolume );
  document.addEventListener( "pointerdown", closeVolumeOnOutsideClick );
  document.addEventListener( "pointerdown", closeOverlaysOnOutsideClick );
  els.closePaytable.addEventListener( "click", () => setPanel( els.paytablePanel, false ) );
  els.closeAudit.addEventListener( "click", () => setPanel( els.auditPanel, false ) );
  els.winCelebration.addEventListener( "pointerdown", skipActiveCelebration );
  els.bonusIntroButton.addEventListener( "click", () => setBonusIntro( false ) );
  els.closeBuyBonus.addEventListener( "click", () => setBuyBonusModal( false ) );
  els.buyBonusMinus.addEventListener( "click", () => stepBuyBonusBet( -1 ) );
  els.buyBonusPlus.addEventListener( "click", () => stepBuyBonusBet( 1 ) );
  els.confirmBuyBonus.addEventListener( "click", buyBonus );
}

async function preloadAssets ()
{
  // Preload core textures/audio to avoid first-spin hiccups.
  const imageAssets = [
    "background.png",
    "reel-frame.png",
    "logo.png",
    "win.png",
    "big-win.png",
    "background-bonus.png",
    ...Object.values( SYMBOLS ).map( ( file ) => `symbols/${ file }` ),
    ...Object.values( BUTTONS )
      .filter( ( button ) => Boolean( button.file ) )
      .map( ( button ) => `buttons/${ button.file }` )
  ];
  const audioAssets = [
    els.bgMusic,
    els.wildSound,
    els.bonusSound,
    ...reelWheelSounds
  ];
  const total = imageAssets.length + audioAssets.length;
  let loaded = 0;
  const tick = () =>
  {
    loaded += 1;
    els.assetLoaderProgress.textContent = `${ Math.round( loaded / total * 100 ) }%`;
  };

  await Promise.all( [
    ...imageAssets.map( ( path ) => preloadImage( assetUrl( path ) ).finally( tick ) ),
    ...audioAssets.map( ( audio ) => preloadAudio( audio ).finally( tick ) )
  ] );
  els.assetLoader.hidden = true;
}

function normalizeApiBaseUrl ( value )
{
  if ( typeof value !== "string" ) return null;
  let url = value.trim();
  if ( !url ) return null;
  if ( url.startsWith( "/" ) ) return url.replace( /\/+$/, "" );

  // Common deploy mistake: "https://https://..."
  url = url.replace( /^https?:\/\/https?:\/\//i, "https://" );
  if ( !/^https?:\/\//i.test( url ) ) url = `https://${ url }`;

  // Remove trailing slash to keep fetch paths consistent.
  url = url.replace( /\/+$/, "" );

  if ( !/^https?:\/\//i.test( url ) ) return null;
  return url;
}

function preloadImage ( src )
{
  return new Promise( ( resolve ) =>
  {
    const image = new Image();
    image.onload = resolve;
    image.onerror = resolve;
    image.src = src;
  } );
}

function preloadAudio ( audio )
{
  return new Promise( ( resolve ) =>
  {
    const done = () => resolve();
    audio.addEventListener( "canplaythrough", done, { once: true } );
    audio.addEventListener( "error", done, { once: true } );
    audio.load();
    window.setTimeout( done, 1200 );
  } );
}

function setupAudio ()
{
  els.bgMusic.loop = true;
  els.bgMusic.volume = Number( els.volumeSlider.value );
  els.bgMusic.muted = false;
  els.wildSound.volume = 0.75;
  els.bonusSound.volume = 0.82;
  reelWheelSounds.forEach( ( audio ) =>
  {
    audio.volume = 0.62;
  } );
  // Volume UI opens only when sound is enabled by user gesture.
  els.volumeControl.hidden = true;
}

async function initSession ()
{
  const response = await postApi( "/init", { playerId: "demo_p_1001", locale: "it-IT", currency: "EUR" } );
  session = response.session;
  // Hard requirement: stake space is server-owned. If missing, we must fail fast
  // to avoid frontend/ backend config drift (root cause of INVALID_BET surprises).
  if ( !response.betOptions
    || !Array.isArray( response.betOptions.coinValues )
    || !Array.isArray( response.betOptions.betLevels )
    || response.betOptions.coinValues.length === 0
    || response.betOptions.betLevels.length === 0 )
  {
    const err = new Error( "BET_OPTIONS_MISSING" );
    err.code = "BET_OPTIONS_MISSING";
    throw err;
  }
  serverBetOptions = response.betOptions;
  displayedBalance = session.balance;
  freeSpinsRemaining = session.activeBonus?.remaining ?? 0;
  els.auditLog.textContent = JSON.stringify( response, null, 2 );
}

async function spin ()
{
  // Frontend never decides result: it requests /spin then animates returned grid.
  if ( !canUseGameApi() ) return;
  if ( currentState === "WIN_PRESENTATION" )
  {
    queuedSpinAfterWin = true;
    skipActiveCelebration();
    return;
  }
  if ( currentState === "SPINNING" ) return;
  currentState = "SPIN_REQUESTED";
  updateHud();

  const bet = getSelectedBet();
  let response;
  try
  {
    response = await spinApi( {
      sessionId: session.sessionId,
      idempotencyKey: `spin-${ ++spinCounter }`,
      bet
    } );
  } catch ( err )
  {
    showError( err );
    return;
  }
  updateBonusTracking( response );

  currentState = "SPINNING";
  startSpinUi();
  displayedBalance = response.balanceAfterDebit;
  displayedWin = 0;
  updateHud( response );
  await animateReelsToResult( response.result.screen );

  lastRound = response;
  renderScreen( response.result.screen, response.result.lineWins );
  stopSpinUi();
  currentState = response.result.freeSpins.triggered ? "BONUS_TRIGGERED" : "RESULT_READY";
  updateHud( response );

  await presentWin( response );
  if ( response.result.freeSpins.triggered )
  {
    queuedSpinAfterWin = false;
    await presentScatterTrigger( response.result.screen );
    displayedWin = response.result.totalWin;
    displayedBalance = response.balanceAfterWin;
    updateHud( response );
    await sleep( getSpinTiming().bonusIntroDelayMs );
    await showBonusIntro();
    currentState = "FREE_SPINS";
    bonusHudActive = true;
    updateHud( response );
    setSpinDisabled( false );
    return;
  }

  if ( queuedSpinAfterWin )
  {
    queuedSpinAfterWin = false;
    currentState = freeSpinsRemaining > 0 ? "FREE_SPINS" : "BETTING";
    updateHud( response );
    spin();
    return;
  }

  if ( freeSpinsRemaining > 0 )
  {
    currentState = "FREE_SPINS";
    updateHud( response );
    setSpinDisabled( false );
    return;
  }

  if ( isBonusComplete( response ) )
  {
    currentState = "BONUS_COMPLETE";
    updateHud( response );
    await presentBonusTotal( response );
    resetBonusTracking();
    displayedWin = 0;
    displayedBalance = response.balanceAfterWin;
    currentState = "BETTING";
    updateHud( response );
    return;
  }

  currentState = "BETTING";
  updateHud( response );
}

async function spinApi ( payload )
{
  const apiResponse = await postApi( "/spin", {
    sessionId: payload.sessionId,
    idempotencyKey: payload.idempotencyKey,
    bet: {
      coinValue: payload.bet.coinValue,
      betLevel: payload.bet.betLevel
    }
  } );
  return mapSpinResponse( apiResponse, payload.sessionId );
}

function mapSpinResponse ( apiResponse, sessionId )
{
  freeSpinsRemaining = apiResponse.freeSpinsRemaining;
  const stakeDebit = apiResponse.featureCost ?? ( apiResponse.round.mode === "BASE" ? apiResponse.bet.totalBet : 0 );
  return {
    roundId: apiResponse.roundId,
    sessionId,
    state: apiResponse.bonusTriggered ? "BONUS_TRIGGERED" : "RESULT_READY",
    balanceAfterDebit: apiResponse.round.balanceBefore - stakeDebit,
    balanceAfterWin: apiResponse.balanceAfter,
    bet: apiResponse.bet,
    result: {
      reelStops: apiResponse.round.reelStops,
      screen: apiResponse.grid,
      lineWins: apiResponse.winningLines,
      scatter: apiResponse.round.scatter ?? { count: 0, multiplier: 0, win: 0, triggered: false },
      multiplier: apiResponse.round.multiplier ?? 1,
      freeSpins: apiResponse.freeSpins ?? { triggered: apiResponse.bonusTriggered, awarded: 0, remaining: apiResponse.freeSpinsRemaining },
      totalWin: apiResponse.win
    },
    round: apiResponse.round
  };
}

function updateBonusTracking ( response )
{
  const awarded = response.result.freeSpins?.awarded ?? 0;
  const startsNewBonus = response.result.freeSpins?.triggered && response.round?.mode === "BASE";
  if ( startsNewBonus )
  {
    // A new trigger must clear the previous bonus totals, but must NOT clear
    // freeSpinsRemaining because mapSpinResponse has just loaded the awarded
    // amount from the backend. Clearing it here would show 10/10 or 20/20
    // before the first free spin is played.
    bonusAwardedSpins = 0;
    bonusTotalWin = 0;
    bonusHudActive = false;
    els.bonusState.textContent = "";
    els.bonusState.hidden = true;
  }
  if ( awarded > 0 )
  {
    bonusAwardedSpins += awarded;
  }
  if ( response.round?.mode === "FREE_SPIN" )
  {
    bonusTotalWin += response.result.totalWin;
  }
}

function isBonusComplete ( response )
{
  // Completion is UI-state based, not only backend mode based, so the HUD cannot
  // remain stuck if a provider uses a slightly different free-spin mode label.
  const hasTrackedBonus = bonusAwardedSpins > 0;
  const noRemainingSpins = freeSpinsRemaining <= 0;
  const noNewTrigger = !response.result.freeSpins?.triggered;
  return hasTrackedBonus && noRemainingSpins && noNewTrigger;
}

function resetBonusTracking ()
{
  bonusAwardedSpins = 0;
  bonusTotalWin = 0;
  freeSpinsRemaining = 0;
  bonusHudActive = false;
  els.bonusState.textContent = "";
  els.bonusState.hidden = true;
}

async function presentScatterTrigger ( screen )
{
  clearPaylines();
  clearPaylineLabels();
  document.querySelectorAll( ".symbol" ).forEach( ( cell ) =>
  {
    const row = Number( cell.dataset.row );
    const reel = Number( cell.dataset.reel );
    const isScatter = screen[ row ]?.[ reel ] === "SCATTER";
    cell.classList.toggle( "scatter-trigger", isScatter );
    cell.classList.toggle( "dimmed", !isScatter );
    cell.classList.remove( "win" );
  } );
  playOneShot( els.bonusSound );
  await sleep( 1350 );
}

async function postApi ( path, payload )
{
  const response = await fetch( `${ API_BASE_URL }${ path }`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify( payload )
  } );
  const body = await response.json().catch( () => ( {} ) );
  if ( !response.ok )
  {
    // Normalize backend errors for HUD/audit panel.
    const message = body?.error?.message ?? `API error ${ response.status }`;
    const error = new Error( message );
    error.code = body?.error?.code ?? `API_${ response.status }`;
    throw error;
  }
  return body;
}

async function presentWin ( response )
{
  // Win amount is shown after reel animation to preserve game pacing.
  if ( response.result.totalWin <= 0 ) return;
  currentState = "WIN_PRESENTATION";
  updateHud( response );
  await presentPaylines( response.result.lineWins );
  await presentWinCelebration( response );
  displayedWin = response.result.totalWin;
  displayedBalance = response.balanceAfterWin;
  updateHud( response );
  await sleep( 180 );
}

function renderBetOptions ()
{
  // Build unique total bets from backend-provided coin/bet matrices.
  els.betSelect.innerHTML = "";
  if ( !serverBetOptions ) throw new Error( "BET_OPTIONS_MISSING" );
  const uniqueBets = new Map();
  const coinValues = serverBetOptions.coinValues;
  const betLevels = serverBetOptions.betLevels;
  for ( const coinValue of coinValues )
  {
    for ( const betLevel of betLevels )
    {
      const bet = normalizeBet( { coinValue, betLevel } );
      if ( uniqueBets.has( bet.totalBet ) ) continue;
      uniqueBets.set( bet.totalBet, { coinValue, betLevel, totalBet: bet.totalBet } );
    }
  }

  const bets = [ ...uniqueBets.values() ].sort( ( a, b ) => a.totalBet - b.totalBet );
  for ( const bet of bets )
  {
    const option = document.createElement( "option" );
    option.value = JSON.stringify( { coinValue: bet.coinValue, betLevel: bet.betLevel } );
    option.textContent = `${ formatMoney( bet.totalBet ) } puntata totale`;
    els.betSelect.append( option );
  }
  els.betSelect.selectedIndex = Math.min( 5, els.betSelect.options.length - 1 );
}

function setupLayout ()
{
  const { canvas, reelFrame, reelWindow, hud } = LAYOUT;
  els.stage.style.setProperty( "--stage-w", canvas.w );
  els.stage.style.setProperty( "--stage-h", canvas.h );
  updateStageScale();
  window.addEventListener( "resize", updateStageScale );
  setRect( document.querySelector( ".stage-frame" ), reelFrame );
  setRect( els.reelsFrame, reelWindow );
  setRect( els.balance.parentElement, hud.balance );
  setRect( els.lastWin.parentElement, hud.win );
  setRect( els.bonusState, hud.status );
  setRect( els.roundState, hud.bet );
}

function updateStageScale ()
{
  const scale = Math.min( window.innerWidth / LAYOUT.canvas.w, window.innerHeight / LAYOUT.canvas.h );
  els.viewport.style.width = `${ LAYOUT.canvas.w * scale }px`;
  els.viewport.style.height = `${ LAYOUT.canvas.h * scale }px`;
  els.stage.style.setProperty( "--stage-scale", scale );
}

function renderButtons ()
{
  // Visual buttons are data-driven from layout/button mappings.
  els.stageButtons.innerHTML = "";
  for ( const [ id, button ] of Object.entries( BUTTONS ) )
  {
    const rect = id === "spin" ? LAYOUT.spinButton : LAYOUT.buttons[ id ];
    if ( !rect ) continue;
    const control = document.createElement( "button" );
    control.type = "button";
    control.className = `asset-button asset-button-${ id }`;
    control.dataset.action = button.action;
    if ( button.action === "toggleTurbo" ) control.classList.toggle( "active", turboEnabled );
    if ( button.action === "toggleSound" )
    {
      control.classList.toggle( "active", soundEnabled );
      control.classList.toggle( "muted", !soundEnabled );
    }
    control.setAttribute( "aria-label", button.action );
    setRect( control, rect );
    control.innerHTML = button.file
      ? `<img src="${ assetUrl( `buttons/${ button.file }` ) }" alt="" onerror="this.hidden=true" /><span>${ fallbackButtonLabel( id ) }</span>`
      : `<span>${ fallbackButtonLabel( id ) }</span>`;
    control.addEventListener( "click", () => runButtonAction( button.action ) );
    els.stageButtons.append( control );
  }
}

function renderPaytable ()
{
  // Paytable is rendered with current selected bet so values are always real in EUR.
  if ( !els.betSelect.value )
  {
    els.paytable.innerHTML = "";
    return;
  }
  const bet = getSelectedBet();
  els.paytable.innerHTML = "";
  const fragment = document.createDocumentFragment();
  for ( const [ symbol, payouts ] of Object.entries( GAME_CONFIG.paytable ) )
  {
    const meta = GAME_CONFIG.symbols[ symbol ];
    const row = document.createElement( "div" );
    row.className = "pay-row";
    row.innerHTML = `
      <div class="pay-symbol">${ renderSymbolMarkup( symbol, "small" ) }</div>
      <div class="pay-values">
        <strong>${ meta.label }</strong>
        <span>3: ${ fmtLineWin( payouts[ 3 ], bet ) } | 4: ${ fmtLineWin( payouts[ 4 ], bet ) } | 5: ${ fmtLineWin( payouts[ 5 ], bet ) }</span>
      </div>
    `;
    fragment.append( row );
  }
  const scatter = document.createElement( "div" );
  scatter.className = "pay-row";
  scatter.innerHTML = `
    <div class="pay-symbol">${ renderSymbolMarkup( "SCATTER", "small" ) }</div>
    <div class="pay-values">
      <strong>Scatter</strong>
      <span>3: ${ formatMoney( bet.totalBet * 2 ) } + 10 FS | 4: ${ formatMoney( bet.totalBet * 10 ) } + 15 FS | 5: ${ formatMoney( bet.totalBet * 50 ) } + 20 FS</span>
    </div>
  `;
  fragment.append( scatter );
  els.paytable.append( fragment );
}

function renderScreen ( screen, lineWins = [] )
{
  // Draw one 5x3 resolved screen from backend response.
  const winningPositions = new Set( lineWins.flatMap( ( win ) => win.positions.map( ( [ row, reel ] ) => `${ row }:${ reel }` ) ) );
  currentScreen = screen;
  els.reels.innerHTML = "";
  for ( let reel = 0; reel < GAME_CONFIG.reels; reel++ )
  {
    const reelEl = document.createElement( "div" );
    reelEl.className = "reel";
    setRect( reelEl, {
      x: symbolX( reel ) - LAYOUT.reelWindow.x,
      y: LAYOUT.grid.startY - LAYOUT.reelWindow.y,
      w: LAYOUT.grid.symbolW,
      h: LAYOUT.grid.rows * LAYOUT.grid.symbolH + ( LAYOUT.grid.rows - 1 ) * LAYOUT.grid.gapY
    } );
    for ( let row = 0; row < GAME_CONFIG.rows; row++ )
    {
      const symbol = screen[ row ][ reel ];
      const meta = GAME_CONFIG.symbols[ symbol ];
      const cell = document.createElement( "div" );
      const isWinningSymbol = winningPositions.has( `${ row }:${ reel }` );
      const dimClass = lineWins.length > 0 && !isWinningSymbol ? " dimmed" : "";
      cell.className = `symbol ${ meta.className }${ isWinningSymbol ? " win" : "" }${ dimClass }`;
      cell.dataset.row = String( row );
      cell.dataset.reel = String( reel );
      setRect( cell, {
        x: 0,
        y: row * ( LAYOUT.grid.symbolH + LAYOUT.grid.gapY ),
        w: LAYOUT.grid.symbolW,
        h: LAYOUT.grid.symbolH
      } );
      cell.innerHTML = renderSymbolMarkup( symbol );
      reelEl.append( cell );
    }
    els.reels.append( reelEl );
  }
}

function clearPaylineLabels ()
{
  els.paylineLabels.innerHTML = "";
}

function createComboLabel ( win, points, color )
{
  const label = document.createElement( "div" );
  label.className = "payline-combo-label";
  label.textContent = `${ win.count }x ${ win.symbol }`;
  const anchor = points[ Math.min( points.length - 1, Math.floor( points.length / 2 ) ) ];
  label.style.setProperty( "--line-color", color );
  label.style.left = `${ anchor.x }px`;
  label.style.top = `${ anchor.y - 44 }px`;
  return label;
}

async function presentPaylines ( lineWins )
{
  // Lines stay visible until the next spin so the winning path remains obvious.
  clearPaylines();
  clearPaylineLabels();
  if ( !lineWins.length ) return;
  lineWins.forEach( ( win ) => drawPayline( win ) );
  await sleep( getSpinTiming().paylineMs );
}

function drawPayline ( win )
{
  const paylineIndex = win.paylineIndex;
  const points = win.positions.map( ( [ row, col ] ) => symbolCenter( col, row ) );
  const polyline = document.createElementNS( "http://www.w3.org/2000/svg", "polyline" );
  polyline.setAttribute( "points", points.map( ( { x, y } ) => `${ x },${ y }` ).join( " " ) );
  polyline.setAttribute( "class", "payline-stroke" );
  polyline.setAttribute( "stroke", lineColor( paylineIndex - 1 ) );
  els.paylineLayer.append( polyline );
  els.paylineLabels.append( createComboLabel( win, points, lineColor( paylineIndex - 1 ) ) );
}

function clearPaylines ()
{
  els.paylineLayer.replaceChildren();
}

async function presentWinCelebration ( response )
{
  const winX = response.result.totalWin / response.bet.totalBet;
  if ( winX < 5 )
  {
    await sleep( getSpinTiming().smallWinMs );
    return;
  }

  const isBigWin = winX >= 15;
  await showCelebration( {
    amount: response.result.totalWin,
    image: isBigWin ? "big-win.png" : "win.png",
    className: isBigWin ? "big" : "regular",
    durationMs: isBigWin ? getSpinTiming().bigWinMs : getSpinTiming().winMs
  } );
}

async function presentBonusTotal ( response )
{
  const isBigWin = bonusTotalWin / response.bet.totalBet >= 15;
  await showCelebration( {
    amount: bonusTotalWin,
    image: isBigWin ? "big-win.png" : "win.png",
    className: `${ isBigWin ? "big" : "regular" } bonus-total`,
    durationMs: 5000
  } );
}

function showBonusIntro ()
{
  els.bonusIntro.hidden = false;
  return new Promise( ( resolve ) =>
  {
    let closed = false;
    let fallbackTimer = 0;
    const close = () =>
    {
      if ( closed ) return;
      closed = true;
      window.clearTimeout( fallbackTimer );
      els.bonusIntro.removeEventListener( "click", close );
      els.bonusIntroButton.removeEventListener( "click", close );
      setBonusIntro( false );
      resolve();
    };
    // The whole bonus splash is clickable, so missing the invisible button cannot block the slot.
    els.bonusIntro.addEventListener( "click", close );
    els.bonusIntroButton.addEventListener( "click", close );
    // Safety fallback for demo stability: never leave the game stuck behind a modal/promise.
    fallbackTimer = window.setTimeout( close, 12000 );
  } );
}

function setBonusIntro ( visible )
{
  els.bonusIntro.hidden = !visible;
}

async function showCelebration ( { amount, image, className, durationMs } )
{
  els.winCelebration.className = `win-celebration ${ className }`;
  els.winCelebrationImage.src = assetUrl( image );
  els.winCelebrationAmount.textContent = formatMoney( amount );
  els.winCelebration.hidden = false;
  await waitForCelebrationSkip( durationMs );
  els.winCelebration.classList.add( "leaving" );
  await sleep( getSpinTiming().exitMs );
  els.winCelebration.hidden = true;
  els.winCelebration.className = "win-celebration";
}

function waitForCelebrationSkip ( ms )
{
  return new Promise( ( resolve ) =>
  {
    let done = false;
    activeCelebrationSkip = () =>
    {
      if ( done ) return;
      done = true;
      activeCelebrationSkip = null;
      resolve();
    };
    window.setTimeout( () => activeCelebrationSkip?.(), ms );
  } );
}

function skipActiveCelebration ()
{
  activeCelebrationSkip?.();
}

async function animateReelsToResult ( finalScreen )
{
  // Reel animation is cosmetic only: symbols are finalized from backend payload.
  const timing = getSpinTiming();
  const symbols = Object.keys( GAME_CONFIG.symbols );
  const tickers = [];
  let scatterTeaseActive = false;
  setScatterTease( false );
  document.querySelectorAll( ".reel" ).forEach( ( reelEl, reelIndex ) =>
  {
    reelEl.classList.add( "rolling" );
    tickers[ reelIndex ] = startReelTicker( reelEl, symbols, timing.reelTickMs, reelIndex );
    startWheelSound( reelIndex );
  } );

  for ( let reel = 0; reel < GAME_CONFIG.reels; reel++ )
  {
    const stoppedScatterCount = countScatterInStoppedReels( finalScreen, reel );
    // Scatter tease starts when first two stopped reels already contain exactly 2 scatters.
    const shouldTease = stoppedScatterCount === 2;
    if ( shouldTease && !scatterTeaseActive )
    {
      scatterTeaseActive = true;
      activateScatterTease( tickers, symbols, reel, finalScreen );
    }

    await sleep( scatterTeaseActive
      ? timing.teaseStopBaseMs + reel * timing.teaseStopStepMs
      : timing.reelStopBaseMs + reel * timing.reelStopStepMs );
    tickers[ reel ]?.();
    stopWheelSound( reel );
    const reelEl = els.reels.children[ reel ];
    reelEl.classList.remove( "rolling", "tease" );
    reelEl.querySelectorAll( ".symbol" ).forEach( ( cell, row ) =>
    {
      const symbol = finalScreen[ row ][ reel ];
      const meta = GAME_CONFIG.symbols[ symbol ];
      cell.className = `symbol ${ meta.className } settle`;
      cell.innerHTML = renderSymbolMarkup( symbol );
      playStopSymbolSound( symbol );
    } );
  }
  setScatterTease( false );
  stopAllWheelSounds();
  await sleep( timing.settleMs );
}

function startReelTicker ( reelEl, symbols, speed, reelIndex = 0 )
{
  // requestAnimationFrame ticker updates rolling placeholders at fixed ms cadence.
  let tick = 0;
  let frameId = 0;
  let lastSwap = 0;
  const run = ( timestamp ) =>
  {
    if ( !lastSwap || timestamp - lastSwap >= speed )
    {
      updateRollingSymbols( reelEl, symbols, tick, reelIndex );
      tick += 1;
      lastSwap = timestamp;
    }
    frameId = window.requestAnimationFrame( run );
  };
  frameId = window.requestAnimationFrame( run );
  return () => window.cancelAnimationFrame( frameId );
}

function updateRollingSymbols ( reelEl, symbols, tick, reelIndex )
{
  reelEl.querySelectorAll( ".symbol" ).forEach( ( cell, row ) =>
  {
    const symbol = symbols[ ( tick + row + reelIndex * 2 ) % symbols.length ];
    const meta = GAME_CONFIG.symbols[ symbol ];
    cell.className = `symbol ${ meta.className } spin`;
    cell.innerHTML = renderSymbolMarkup( symbol );
  } );
}

function activateScatterTease ( tickers, symbols, currentReel, finalScreen )
{
  const timing = getSpinTiming();
  markStoppedScatterReels( finalScreen, currentReel );
  for ( let reel = currentReel; reel < GAME_CONFIG.reels; reel++ )
  {
    const reelEl = els.reels.children[ reel ];
    tickers[ reel ]?.();
    reelEl.classList.add( "tease" );
    tickers[ reel ] = startReelTicker( reelEl, symbols, timing.teaseTickMs, reel );
  }
  setScatterTease( true );
}

function markStoppedScatterReels ( screen, nextReelIndex )
{
  for ( let reel = 0; reel < nextReelIndex; reel++ )
  {
    const hasScatter = screen.some( ( row ) => row[ reel ] === "SCATTER" );
    els.reels.children[ reel ]?.classList.toggle( "scatter-locked", hasScatter );
  }
}

function startWheelSound ( reelIndex )
{
  if ( !soundEnabled ) return;
  const audio = reelWheelSounds[ reelIndex ];
  audio.currentTime = 0;
  audio.play().catch( () => { } );
}

function stopWheelSound ( reelIndex )
{
  const audio = reelWheelSounds[ reelIndex ];
  audio.pause();
  audio.currentTime = 0;
}

function stopAllWheelSounds ()
{
  reelWheelSounds.forEach( ( _, index ) => stopWheelSound( index ) );
}

function handleVisibilityChange ()
{
  if ( document.hidden )
  {
    stopAllWheelSounds();
    els.bgMusic.pause();
    return;
  }
  if ( soundEnabled ) startMusic();
}

function playStopSymbolSound ( symbol )
{
  if ( !soundEnabled ) return;
  if ( symbol === "WILD" ) playOneShot( els.wildSound );
  if ( symbol === "SCATTER" ) playOneShot( els.bonusSound );
}

function playOneShot ( audio )
{
  const effect = audio.cloneNode( true );
  effect.volume = audio.volume;
  effect.play().catch( () => { } );
}

function countScatterInStoppedReels ( screen, nextReelIndex )
{
  // Reads only already-stopped reels to decide tease pacing.
  let count = 0;
  for ( let reel = 0; reel < nextReelIndex; reel++ )
  {
    for ( let row = 0; row < GAME_CONFIG.rows; row++ )
    {
      if ( screen[ row ][ reel ] === "SCATTER" ) count += 1;
    }
  }
  return count;
}

function startSpinUi ()
{
  setSpinDisabled( true );
  setScatterTease( false );
  clearPaylines();
  clearPaylineLabels();
  els.winCelebration.hidden = true;
  els.winCelebration.className = "win-celebration";
  setBonusIntro( false );
  activeCelebrationSkip = null;
  stopAllWheelSounds();
  document.querySelectorAll( ".symbol" ).forEach( ( cell ) => cell.classList.remove( "win", "dimmed", "scatter-trigger" ) );
  document.querySelectorAll( ".reel" ).forEach( ( reel ) => reel.classList.remove( "scatter-locked" ) );
}

function stopSpinUi ()
{
  setSpinDisabled( false );
  setScatterTease( false );
}

function updateHud ( response = null )
{
  // HUD state is derived from current finite-state-machine + latest round payload.
  els.balance.textContent = formatMoney( displayedBalance );
  els.roundState.textContent = stateLabel( currentState );
  els.lastWin.textContent = formatMoney( displayedWin );
  const bonusText = bonusLabel();
  els.bonusState.textContent = bonusText;
  els.bonusState.hidden = bonusText === "";
  setSpinDisabled( currentState === "SPINNING" || currentState === "SPIN_REQUESTED" );
  if ( response?.round ) els.auditLog.textContent = JSON.stringify( response.round, null, 2 );
}

function bonusLabel ()
{
  if ( !bonusHudActive ) return "";
  if ( bonusAwardedSpins > 0 )
  {
    const completed = Math.max( 0, bonusAwardedSpins - freeSpinsRemaining );
    return `Free Spins: ${ completed }/${ bonusAwardedSpins } | Bonus ${ formatMoney( bonusTotalWin ) }`;
  }
  return freeSpinsRemaining > 0 ? `Free Spins: ${ freeSpinsRemaining }` : "";
}

function setScatterTease ( active )
{
  els.reelsFrame?.classList.toggle( "scatter-tease", active );
  els.scatterTeaseBanner.hidden = !active;
}

function getSelectedBet ()
{
  if ( !els.betSelect.value ) throw gameUiError( "BET_NOT_READY", "Puntate non ancora caricate dal server." );
  const selected = JSON.parse( els.betSelect.value );
  return normalizeBet( selected );
}

function canUseGameApi ()
{
  if ( session && els.betSelect.value ) return true;
  const err = gameUiError( "GAME_NOT_READY", "Sessione non ancora inizializzata. Controlla il backend Render e ricarica." );
  showError( err );
  return false;
}

function normalizeBet ( bet )
{
  // Mirror of backend formula used for frontend preview only.
  const normalized = {
    coinValue: Number( bet?.coinValue ?? GAME_CONFIG.coinValues[ 0 ] ),
    betLevel: Number( bet?.betLevel ?? GAME_CONFIG.betLevels[ 0 ] ),
    paylines: GAME_CONFIG.fixedPaylines
  };
  normalized.totalBet = normalized.coinValue * normalized.betLevel * normalized.paylines;
  normalized.lineBet = normalized.totalBet / normalized.paylines;
  return normalized;
}

function emptyScreen ()
{
  return [
    [ "N1", "N2", "N3", "N4", "N5" ],
    [ "N6", "N7", "WILD", "N8", "N9" ],
    [ "N5", "N4", "SCATTER", "N2", "N1" ]
  ];
}

function showError ( err )
{
  // Keep game interactive after recoverable API error.
  currentState = "ERROR";
  stopAllWheelSounds();
  els.roundState.textContent = `ERROR ${ err.code ?? "" }`;
  els.auditLog.textContent = JSON.stringify( { code: err.code, message: err.message }, null, 2 );
  setSpinDisabled( false );
}

function formatMoney ( cents )
{
  return new Intl.NumberFormat( "it-IT", { style: "currency", currency: GAME_CONFIG.currency } ).format( cents / 100 );
}

function fmtLineWin ( value, bet )
{
  if ( value == null ) return "-";
  return formatMoney( value * GAME_CONFIG.paytableScale * bet.lineBet );
}

function renderSymbolMarkup ( symbol, size = "" )
{
  const meta = GAME_CONFIG.symbols[ symbol ];
  const sizeClass = size ? ` ${ size }` : "";
  const file = SYMBOLS[ symbol ];
  const label = meta?.label ?? symbol;
  return `<div class="symbol-inner${ sizeClass }" title="${ label }"><img src="${ assetUrl( `symbols/${ file }` ) }" alt="${ label }" onerror="this.hidden=true; this.nextElementSibling.hidden=false" /><span hidden>${ meta?.glyph ?? symbol }</span></div>`;
}

function symbolCenter ( col, row )
{
  return {
    x: symbolX( col ) + LAYOUT.grid.symbolW / 2,
    y: LAYOUT.grid.startY + row * ( LAYOUT.grid.symbolH + LAYOUT.grid.gapY ) + LAYOUT.grid.symbolH / 2
  };
}

function lineColor ( index )
{
  return LAYOUT.paylineColors[ index % LAYOUT.paylineColors.length ];
}

function runButtonAction ( action )
{
  // Action dispatch is centralized to keep button mapping declarative.
  const actions = {
    spin,
    decreaseBet,
    increaseBet,
    setMaxBet,
    openPaytable: () => setPanel( els.paytablePanel, true ),
    openMenu: () => setPanel( els.auditPanel, true ),
    openBuyBonus,
    toggleTurbo,
    toggleSound
  };
  actions[ action ]?.();
}

function toggleTurbo ()
{
  // Turbo only adjusts timings, not RNG or payout logic.
  turboEnabled = !turboEnabled;
  els.stage.classList.toggle( "turbo-mode", turboEnabled );
  document.querySelector( '[data-action="toggleTurbo"]' )?.classList.toggle( "active", turboEnabled );
}

function toggleSound ()
{
  soundEnabled = !soundEnabled;
  els.stage.classList.toggle( "sound-off", !soundEnabled );
  const soundButton = document.querySelector( '[data-action="toggleSound"]' );
  soundButton?.classList.toggle( "active", soundEnabled );
  soundButton?.classList.toggle( "muted", !soundEnabled );
  els.volumeControl.hidden = !soundEnabled;
  if ( soundEnabled )
  {
    startMusic();
  } else
  {
    els.bgMusic.pause();
  }
}

function closeVolumeOnOutsideClick ( event )
{
  if ( els.volumeControl.hidden ) return;
  const soundButton = document.querySelector( '[data-action="toggleSound"]' );
  const target = event.target;
  if ( els.volumeControl.contains( target ) || soundButton?.contains( target ) ) return;
  els.volumeControl.hidden = true;
}

function closeOverlaysOnOutsideClick ( event )
{
  // Buy-bonus has a full-screen backdrop: clicking the dark area closes it.
  if ( !els.buyBonusModal.hidden && event.target === els.buyBonusModal )
  {
    setBuyBonusModal( false );
    return;
  }

  // Paytable/audit are centered panels without a backdrop: any click outside closes them.
  if ( !els.paytablePanel.hidden
    && !els.paytablePanel.contains( event.target )
    && !event.target.closest( '[data-action="openPaytable"]' ) )
  {
    setPanel( els.paytablePanel, false );
  }

  if ( !els.auditPanel.hidden
    && !els.auditPanel.contains( event.target )
    && !event.target.closest( '[data-action="openMenu"]' ) )
  {
    setPanel( els.auditPanel, false );
  }
}

async function startMusic ()
{
  // Browsers may block autoplay; fallback resets UI to muted state.
  updateMusicVolume();
  try
  {
    if ( !audioReady )
    {
      els.bgMusic.currentTime = 0;
      audioReady = true;
    }
    await els.bgMusic.play();
  } catch ( err )
  {
    soundEnabled = false;
    els.stage.classList.add( "sound-off" );
    els.volumeControl.hidden = true;
    const soundButton = document.querySelector( '[data-action="toggleSound"]' );
    soundButton?.classList.remove( "active" );
    soundButton?.classList.add( "muted" );
    console.warn( "Audio playback blocked or unsupported.", err );
  }
}

function updateMusicVolume ()
{
  const volume = Number( els.volumeSlider.value );
  const safeVolume = Number.isFinite( volume ) ? volume : 0.45;
  els.bgMusic.volume = safeVolume;
  els.wildSound.volume = Math.min( 1, safeVolume + 0.25 );
  els.bonusSound.volume = Math.min( 1, safeVolume + 0.32 );
  reelWheelSounds.forEach( ( audio ) =>
  {
    audio.volume = Math.max( 0.12, safeVolume * 0.9 );
  } );
}

function getSpinTiming ()
{
  return turboEnabled ? SPIN_TIMINGS.turbo : SPIN_TIMINGS.normal;
}

function decreaseBet ()
{
  if ( !els.betSelect.options.length ) return;
  els.betSelect.selectedIndex = Math.max( 0, els.betSelect.selectedIndex - 1 );
  renderPaytable();
  updateHud();
}

function increaseBet ()
{
  if ( !els.betSelect.options.length ) return;
  els.betSelect.selectedIndex = Math.min( els.betSelect.options.length - 1, els.betSelect.selectedIndex + 1 );
  renderPaytable();
  updateHud();
}

function setMaxBet ()
{
  if ( !els.betSelect.options.length ) return;
  els.betSelect.selectedIndex = els.betSelect.options.length - 1;
  renderPaytable();
  updateHud();
}

function openBuyBonus ()
{
  if ( !canUseGameApi() ) return;
  if ( currentState === "SPINNING" || currentState === "SPIN_REQUESTED" || freeSpinsRemaining > 0 ) return;
  buyBonusBetIndex = Math.max( 0, els.betSelect.selectedIndex );
  renderBuyBonusModal();
  setBuyBonusModal( true );
}

function setBuyBonusModal ( open )
{
  els.buyBonusModal.hidden = !open;
}

function stepBuyBonusBet ( direction )
{
  buyBonusBetIndex = Math.max( 0, Math.min( els.betSelect.options.length - 1, buyBonusBetIndex + direction ) );
  renderBuyBonusModal();
}

function renderBuyBonusModal ()
{
  const bet = normalizeBet( JSON.parse( els.betSelect.options[ buyBonusBetIndex ].value ) );
  els.buyBonusBet.textContent = formatMoney( bet.totalBet );
  els.buyBonusCost.textContent = formatMoney( bet.totalBet * 30 );
}

async function buyBonus ()
{
  if ( !canUseGameApi() ) return;
  const bet = normalizeBet( JSON.parse( els.betSelect.options[ buyBonusBetIndex ].value ) );
  els.betSelect.selectedIndex = buyBonusBetIndex;
  renderPaytable();
  setBuyBonusModal( false );
  let response;
  try
  {
    const apiResponse = await postApi( "/buy-bonus", {
      sessionId: session.sessionId,
      idempotencyKey: `buy-bonus-${ ++spinCounter }`,
      bet: {
        coinValue: bet.coinValue,
        betLevel: bet.betLevel
      }
    } );
    response = mapSpinResponse( apiResponse, session.sessionId );
  } catch ( err )
  {
    showError( err );
    return;
  }
  updateBonusTracking( response );
  currentState = "SPINNING";
  displayedBalance = response.balanceAfterDebit;
  displayedWin = 0;
  updateHud();
  startSpinUi();
  await animateReelsToResult( response.result.screen );
  renderScreen( response.result.screen, response.result.lineWins );
  stopSpinUi();
  await presentWin( response );
  await presentScatterTrigger( response.result.screen );
  displayedWin = response.result.totalWin;
  displayedBalance = response.balanceAfterWin;
  updateHud( response );
  await sleep( getSpinTiming().bonusIntroDelayMs );
  await showBonusIntro();
  currentState = "FREE_SPINS";
  bonusHudActive = true;
  updateHud( response );
  setSpinDisabled( false );
}

function setPanel ( panel, open )
{
  panel.hidden = !open;
}

function setSpinDisabled ( disabled )
{
  document.querySelector( '[data-action="spin"]' )?.toggleAttribute( "disabled", disabled );
}

function setRect ( element, rect )
{
  // Utility to apply absolute pixel rect from layout config.
  element.style.left = `${ rect.x }px`;
  element.style.top = `${ rect.y }px`;
  element.style.width = `${ rect.w }px`;
  element.style.height = `${ rect.h }px`;
}

function gameUiError ( code, message )
{
  const error = new Error( message );
  error.code = code;
  return error;
}

function symbolX ( col )
{
  return LAYOUT.grid.startX + col * ( LAYOUT.grid.symbolW + LAYOUT.grid.gapX );
}

function fallbackButtonLabel ( id )
{
  const labels = {
    menu: "Menu",
    info: "Info",
    betMinus: "-",
    betPlus: "+",
    maxBet: "MAX",
    buyBonus: "BONUS",
    spin: "Spin",
    turbo: "Turbo",
    sound: "Sound"
  };
  return labels[ id ] ?? id;
}

function stateLabel ( state )
{
  // Human-friendly labels for machine states shown in HUD.
  const labels = {
    IDLE: "Pronto",
    BETTING: "Scegli puntata",
    SPIN_REQUESTED: "Richiesta spin",
    SPINNING: "Rulli in movimento",
    RESULT_READY: "Risultato pronto",
    WIN_PRESENTATION: "Presentazione vincita",
    BONUS_TRIGGERED: "Bonus attivato",
    FREE_SPINS: "Free Spins",
    BONUS_COMPLETE: "Bonus concluso",
    COLLECT: "Incassato",
    ERROR: "Errore"
  };
  return labels[ state ] ?? state;
}

function sleep ( ms )
{
  return new Promise( ( resolve ) => setTimeout( resolve, ms ) );
}
