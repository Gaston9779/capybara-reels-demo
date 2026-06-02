import { assetUrl } from "./layout.js";

export const SARCOPHAGUS_TEST_MODE = true;
export const SARCOPHAGUS_STAGE_THRESHOLDS = [0, 1, 3, 5, 7, 9, 11, 13];

const SARCOPHAGUS_STAGES = [
  "sprites/sarcophagus_1.png",
  "sprites/sarcophagus_2.png",
  "sprites/sarcophagus_3.png",
  "sprites/sarcophagus_4.png",
  "sprites/sarcophagus_5.png",
  "sprites/sarcophagus_6.png",
  "sprites/sarcophagus_7.png"
];

const DEFAULT_OPTIONS = {
  containerId: "sarcophagusContainer",
  position: { x: -52, y: 122 },
  size: { w: 430, h: 760 },
  coinSize: 108,
  coinDurationMs: 1020,
  stageDurationMs: 260,
  stageDelayMs: 20,
  finalResetDelayMs: 420
};

export class SarcophagusMeter {
  constructor ( app, options = {} )
  {
    this.app = app;
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
      position: { ...DEFAULT_OPTIONS.position, ...options.position },
      size: { ...DEFAULT_OPTIONS.size, ...options.size }
    };
    this.currentStageIndex = 0;
    this.totalCollectedScatters = 0;
    this.container = null;
    this.sprite = null;
    this.activeAnimations = new Set();
    this.destroyed = false;
  }

  init ()
  {
    this.container = document.querySelector( `#${ this.options.containerId }` ) ?? document.createElement( "div" );
    this.container.id = this.options.containerId;
    this.container.className = "sarcophagus-meter";
    this.container.style.left = `${ this.options.position.x }px`;
    this.container.style.top = `${ this.options.position.y }px`;
    this.container.style.width = `${ this.options.size.w }px`;
    this.container.style.height = `${ this.options.size.h }px`;
    if ( !this.container.parentElement ) this.app.append( this.container );

    this.sprite = this.createStageSprite( 0 );
    this.sprite.classList.add( "active" );
    this.container.replaceChildren( this.sprite );
    this.container.classList.add( "idle" );
    return this;
  }

  async setStage ( stageIndex )
  {
    if ( this.destroyed || !this.container ) return;
    const nextStageIndex = clampStage( stageIndex );
    if ( nextStageIndex === this.currentStageIndex && this.sprite ) return;

    const oldSprite = this.sprite;
    const nextSprite = this.createStageSprite( nextStageIndex );
    this.container.append( nextSprite );
    this.sprite = nextSprite;
    this.currentStageIndex = nextStageIndex;

    const oldAnimation = oldSprite?.animate( [
      { opacity: 1, transform: "scaleX(-1) scale(1)" },
      { opacity: 0, transform: "scaleX(-1) scale(1.04)" }
    ], {
      duration: this.options.stageDurationMs,
      easing: "ease-out",
      fill: "forwards"
    } );
    const nextAnimation = nextSprite.animate( [
      { opacity: 0, transform: "scaleX(-1) scale(0.95)"},
      { opacity: 1, transform: "scaleX(-1) scale(1.06)", offset: 0.72},
      { opacity: 1, transform: "scaleX(-1) scale(1)" }
    ], {
      duration: this.options.stageDurationMs,
      easing: "ease-out",
      fill: "forwards"
    } );

    this.trackAnimation( oldAnimation );
    this.trackAnimation( nextAnimation );
    await Promise.all( [ oldAnimation?.finished.catch( () => {} ), nextAnimation.finished.catch( () => {} ) ] );
    oldSprite?.remove();
    nextSprite.classList.add( "active" );
  }

  async animateScatterCoins ( scatterPositions )
  {
    if ( this.destroyed || !this.container || !scatterPositions?.length ) return;
    const animations = scatterPositions.map( ( scatterPosition, index ) => this.animateCoin( scatterPosition, index ) );
    await Promise.all( animations );
  }

  async handleScatterResult ( scatterPositions, shouldTriggerBonus = false )
  {
    if ( this.destroyed || !scatterPositions?.length ) return;
    await this.animateScatterCoins( scatterPositions );

    if ( SARCOPHAGUS_TEST_MODE )
    {
      this.totalCollectedScatters += scatterPositions.length;
      await this.syncStageToTestThresholds();
      return;
    }

    if ( shouldTriggerBonus )
    {
      await this.fillToFinalStage();
      await this.explode();
      this.reset();
      return;
    }

    await this.setStage( this.currentStageIndex + Math.min( 2, scatterPositions.length ) );
  }

  async fillToFinalStage ()
  {
    for ( let stageIndex = this.currentStageIndex + 1; stageIndex < SARCOPHAGUS_STAGES.length; stageIndex++ )
    {
      await this.setStage( stageIndex );
      await sleep( this.options.stageDelayMs );
    }
  }

  async explode ()
  {
    if ( this.destroyed || !this.container ) return;
    this.container.classList.add( "explode" );
    const burst = document.createElement( "div" );
    burst.className = "sarcophagus-burst";
    this.container.append( burst );
    const animation = burst.animate( [
      { opacity: 0.95, transform: "translate(-50%, -50%) scale(0.2)" },
      { opacity: 0.65, transform: "translate(-50%, -50%) scale(1.25)", offset: 0.55 },
      { opacity: 0, transform: "translate(-50%, -50%) scale(1.75)" }
    ], {
      duration: 620,
      easing: "ease-out"
    } );
    this.trackAnimation( animation );
    await animation.finished.catch( () => {} );
    burst.remove();
    this.container.classList.remove( "explode" );
  }

  reset ()
  {
    this.totalCollectedScatters = 0;
    this.currentStageIndex = 0;
    if ( !this.container ) return;
    this.sprite = this.createStageSprite( 0 );
    this.sprite.classList.add( "active" );
    this.container.replaceChildren( this.sprite );
  }

  destroy ()
  {
    this.destroyed = true;
    this.activeAnimations.forEach( ( animation ) => animation.cancel() );
    this.activeAnimations.clear();
    this.container?.replaceChildren();
    this.container?.remove();
    this.container = null;
    this.sprite = null;
  }

  createStageSprite ( stageIndex )
  {
    const image = document.createElement( "img" );
    image.className = "sarcophagus-sprite";
    image.src = assetUrl( SARCOPHAGUS_STAGES[ clampStage( stageIndex ) ] );
    image.alt = "";
    return image;
  }

  async animateCoin ( scatterPosition, index )
  {
    const coin = document.createElement( "img" );
    coin.className = "sarcophagus-coin";
    coin.src = assetUrl( "coin.png" );
    coin.alt = "";
    coin.style.width = `${ this.options.coinSize }px`;
    coin.style.height = `${ this.options.coinSize }px`;
    coin.style.left = `${ scatterPosition.x }px`;
    coin.style.top = `${ scatterPosition.y }px`;
    this.app.append( coin );

    const target = this.targetPoint();
    const curveLift = 120 + index * 18;
    const animation = coin.animate( [
      { opacity: 1, transform: "translate(-50%, -50%) scale(0.45) rotate(0deg)", left: `${ scatterPosition.x }px`, top: `${ scatterPosition.y }px`,filter: "drop-shadow(0 0 20px rgba(255, 223, 0, 0.8))" },
      { opacity: 1, transform: "translate(-50%, -50%) scale(0.92) rotate(90deg)",filter: "drop-shadow(0 0 20px rgba(255, 223, 0, 0.8))", left: `${ ( scatterPosition.x + target.x ) / 2 }px`, top: `${ Math.min( scatterPosition.y, target.y ) - curveLift }px`, offset: 0.48, },
      { opacity: 1, transform: "translate(-50%, -50%) scale(0.35) rotate(260deg)",filter: "drop-shadow(0 0 20px rgba(255, 223, 0, 0.8))", left: `${ target.x }px`, top: `${ target.y }px` }
    ], {
      duration: this.options.coinDurationMs + index * 70,
      easing: "cubic-bezier(.2,.78,.22,1)",
      fill: "forwards"
    } );
    this.trackAnimation( animation );
    await animation.finished.catch( () => {} );
    coin.remove();
  }

  async syncStageToTestThresholds ()
  {
    const targetStage = stageForCollectedScatters( this.totalCollectedScatters );
    for ( let stageIndex = this.currentStageIndex + 1; stageIndex <= targetStage; stageIndex++ )
    {
      await this.setStage( stageIndex );
      await sleep( this.options.stageDelayMs );
    }
    if ( this.totalCollectedScatters >= SARCOPHAGUS_STAGE_THRESHOLDS.at( -1 ) )
    {
      await this.explode();
      await sleep( this.options.finalResetDelayMs );
      this.reset();
    }
  }

  targetPoint ()
  {
    return {
      x: this.options.position.x + this.options.size.w * 0.52,
      y: this.options.position.y + this.options.size.h * 0.48
    };
  }

  trackAnimation ( animation )
  {
    if ( !animation ) return;
    this.activeAnimations.add( animation );
    animation.finished.finally( () => this.activeAnimations.delete( animation ) ).catch( () => {} );
  }
}

function stageForCollectedScatters ( totalCollectedScatters )
{
  let stageIndex = 0;
  for ( let thresholdIndex = 1; thresholdIndex < SARCOPHAGUS_STAGE_THRESHOLDS.length - 1; thresholdIndex++ )
  {
    if ( totalCollectedScatters >= SARCOPHAGUS_STAGE_THRESHOLDS[ thresholdIndex ] ) stageIndex = thresholdIndex;
  }
  return clampStage( stageIndex );
}

function clampStage ( stageIndex )
{
  return Math.max( 0, Math.min( SARCOPHAGUS_STAGES.length - 1, Number( stageIndex ) || 0 ) );
}

function sleep ( ms )
{
  return new Promise( ( resolve ) => window.setTimeout( resolve, ms ) );
}
