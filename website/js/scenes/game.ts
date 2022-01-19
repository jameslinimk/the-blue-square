import { Coordinates } from "../angles"
import { CustomAnimation } from "../animations"
import { config } from "../config"
import { BaseScene, Events, KeyDownEvent, MouseDownEvent, MouseMoveEvent, PressedKeys } from "../game"
import { CustomImage } from "../image"
import { Sound } from "../sound"
import { Bullet } from "./game/bullet"
import { Ball } from "./game/enemies/ballEnemy"
import { Enemy } from "./game/enemies/enemy"
import { Ray } from "./game/enemies/rangedEnemy"
import { Map } from "./game/map"
import { Player } from "./game/player"
import { DungeonManager } from "./game/roundManager"
import { drawHud, margin, SystemMessage } from "./hud"
import { shooting } from "./shooting"

function random(min: number, max: number) {
    return (Math.random() * (max - min)) + min
}

function clamp(number: number, min: number, max: number) {
    return Math.min(Math.max(number, min), max)
}

class GameScene extends BaseScene {
    /* ---------------------------------- Misc ---------------------------------- */
    player: Player
    mouse: Coordinates
    systemMessages: SystemMessage[]
    systemMessagesId: number

    /* --------------------------------- Bullets -------------------------------- */
    bullets: Bullet[]
    noAmmoSound: Sound
    bulletId: number
    lastShot: number

    /* --------------------------------- Enemies -------------------------------- */
    enemies: Enemy[]
    enemyId: number
    rays: Ray[]
    rayId: number
    balls: Ball[]
    ballId: number

    /* --------------------------------- Crates --------------------------------- */
    cratePickupSound: Sound

    /* -------------------------------- Managers -------------------------------- */
    dungeonManager: DungeonManager
    map: Map

    /* --------------------------------- Images --------------------------------- */
    healthImage: CustomImage
    coinsImage: CustomImage
    crateImage: CustomImage
    frameImage: CustomImage
    smallAmmoImage: CustomImage
    mediumAmmoImage: CustomImage
    largeAmmoImage: CustomImage
    shellsAmmoImage: CustomImage
    rangedEnemyImage: CustomImage
    shopGuyImage: CustomImage
    dummyImage: CustomImage

    /* -------------------------------- Inventory ------------------------------- */
    showInventory: boolean
    showInventoryX: number
    showInventoryAnimation: CustomAnimation
    hideInventoryAnimation: CustomAnimation

    /* --------------------------------- Pausing -------------------------------- */
    private _paused: boolean
    get paused() { return this._paused }
    set paused(paused: boolean) {
        if (this._paused === paused) return
        this._paused = paused

        if (paused) {
            // this.pausedAt = performance.now()
            return
        }
    }
    // TODO Make getTicks() pause when paused
    pausedAt: number

    constructor() {
        super()

        this.player = new Player(config.width / 2, config.height - 50, this)
        this.mouse = { x: 0, y: 0 }
        this.systemMessages = []
        this.systemMessagesId = 0

        this.bullets = []
        // this.bulletSound = new Sound("../../sounds/laserShoot.wav")
        this.noAmmoSound = new Sound("./sounds/noammo.mp3")
        this.bulletId = 0
        this.lastShot = 0

        this.enemies = []
        this.enemyId = 0
        this.rays = []
        this.rayId = 0
        this.balls = []
        this.ballId = 0

        this.cratePickupSound = new Sound("./sounds/pickupCoin.wav")

        this.dungeonManager = new DungeonManager(this)
        this.map = new Map(this)

        this.healthImage = new CustomImage("./images/health.png")
        this.crateImage = new CustomImage("./images/crate.png")
        this.coinsImage = new CustomImage("./images/coin.png")
        this.frameImage = new CustomImage("./images/guns/frame.png")
        this.smallAmmoImage = new CustomImage("./images/smallammo.png")
        this.mediumAmmoImage = new CustomImage("./images/mediumammo.png")
        this.largeAmmoImage = new CustomImage("./images/largeammo.png")
        this.shellsAmmoImage = new CustomImage("./images/shellsammo.png")
        this.rangedEnemyImage = new CustomImage("./images/skins/rangedEnemy.png")
        this.shopGuyImage = new CustomImage('./images/skins/shopGuy.png')
        this.dummyImage = new CustomImage('./images/skins/dummy.png')

        this.showInventory = false
        this.showInventoryX = config.width - margin
        this.showInventoryAnimation = new CustomAnimation(250, 64, (movePerFrame) => {
            this.showInventoryX -= movePerFrame
        }, () => {
            this.showInventoryX = config.width - margin
        }, () => {
            this.showInventoryX = config.width - 64 - margin
        })

        this.hideInventoryAnimation = new CustomAnimation(250, 64, (movePerFrame) => {
            this.showInventoryX += movePerFrame
        }, () => {
            this.showInventoryX = config.width - 64 - margin
        }, () => {
            this.showInventoryX = config.width - margin
        })

        this._paused = false
        this.pausedAt = performance.now()
    }

    processInput(events: Events, pressedKeys: PressedKeys, dt: number) {
        this.player.processInput(events, pressedKeys, dt)
        this.map.processInput(events)

        /* -------------------------------------------------------------------------- */
        /*                                   Events                                   */
        /* -------------------------------------------------------------------------- */
        let shot = !this.paused && this.player.gun.holdable && pressedKeys.get("Mouse Left") && this.getTicks() >= this.lastShot + this.player.gun.shootDelay
        events.forEach(event => {
            switch (event.eventType) {
                case "MouseMove":
                    event = <MouseMoveEvent>event

                    // Get mouse relative to canvas element
                    if (!this.ctx.canvas) break
                    const rect = this.ctx.canvas.getBoundingClientRect()
                    const scaleX = this.ctx.canvas.width / rect.width
                    const scaleY = this.ctx.canvas.height / rect.height

                    this.mouse = { x: (event.raw.clientX - rect.left) * scaleX, y: (event.raw.clientY - rect.top) * scaleY }
                    break

                case "MouseDown":
                    if (this.paused || shot) break

                    event = <MouseDownEvent>event
                    if (!shot && event.raw.button === 0 && this.getTicks() >= this.lastShot + this.player.gun.shootDelay) {
                        shot = true
                    }
                    break

                case "KeyDown":
                    event = <KeyDownEvent>event
                    switch (event.key.toLowerCase()) {
                        case "f":
                            this.ctx.canvas.requestFullscreen()
                            break
                        case "i":
                            if (this.paused) break

                            if (!this.showInventory) {
                                this.showInventoryAnimation.on = true
                                this.showInventory = true
                            } else {
                                this.hideInventoryAnimation.on = true
                                this.showInventory = false
                            }
                            break
                        case "m":
                            if (this.dungeonManager.currentRoomObject !== "0" && this.dungeonManager.currentRoomObject !== null && this.dungeonManager.currentRoomObject.type === "dungeon" && !this.dungeonManager.currentRoomObject.dungeonRounds?.cleared) {
                                this.systemMessages.push({
                                    sentAt: performance.now(),
                                    message: "You cannot access the navigator during combat!",
                                    id: this.systemMessagesId
                                })
                                this.systemMessagesId += 1
                                break
                            }
                            this.map.mapNavigator = !this.map.mapNavigator
                            break
                        case "p":
                            console.log("Pause")
                            this.paused = !this.paused
                            break
                    }
                    break
            }
        })

        // Shooting
        if (shot) shooting(this)
    }

    update(dt: number) {
        if (this.paused) return

        /* -------------------------------- Universal ------------------------------- */
        this.dungeonManager.update(dt)
        this.player.update(dt)
        this.showInventoryAnimation.update(dt)
        this.hideInventoryAnimation.update(dt)
    }

    draw() {
        // Background
        this.ctx.fillStyle = "#5a6988"
        this.ctx.fillRect(0, 0, config.width, config.height)

        /* --------------------------------- Dungeon -------------------------------- */
        this.dungeonManager.draw()

        /* -------------------------------- Universal ------------------------------- */
        this.player.draw()
        drawHud(this.ctx, this)
        this.map.draw()
    }

    getTicks() {
        return performance.now()
    }
}

export {
    GameScene,
    random,
    clamp
}

