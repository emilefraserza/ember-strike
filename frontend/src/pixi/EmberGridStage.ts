import { Application, Assets, Container, Graphics, Sprite, Text, TextStyle, Texture } from "pixi.js";
import type { BonusTier, SymbolCode } from "../types/ember";
import { GRID_SIZE } from "../engine/emberEngine";
import { SYMBOL_MANIFEST } from "../engine/symbolManifest";

export class EmberGridStage {
  private app: Application;
  private root = new Container();
  private tileBgs: Graphics[][] = [];
  private spriteLayers: (Sprite | null)[][] = [];
  private symbolTexts: Text[][] = [];
  private multTexts: Text[][] = [];
  private textures: Partial<Record<SymbolCode, Texture>> = {};
  private boardSize = 480;

  constructor(app: Application) {
    this.app = app;
    this.app.stage.addChild(this.root);
    this.buildGrid();
    this.layout();
  }

  public async loadTextures(spriteBasePath = "./assets/symbols/"): Promise<void> {
    for (const meta of Object.values(SYMBOL_MANIFEST)) {
      try {
        this.textures[meta.code] = await Assets.load(`${spriteBasePath}${meta.spriteFile}`);
      } catch {
        // Fallback to high-contrast stylized text labels if image files are not copied into public/assets/symbols/
      }
    }
  }

  private buildGrid(): void {
    const frame = new Graphics();
    frame.roundRect(-8, -8, this.boardSize + 16, this.boardSize + 16, 10);
    frame.fill({ color: 0x16181d });
    frame.stroke({ width: 2, color: 0xffffff, alpha: 0.7 });
    this.root.addChild(frame);

    const gap = 8;
    const cellSize = (this.boardSize - gap * (GRID_SIZE - 1)) / GRID_SIZE;

    const symStyle = new TextStyle({
      fontFamily: "Oswald, Space Grotesk, sans-serif",
      fontSize: Math.round(cellSize * 0.2),
      fontWeight: "700",
      fill: 0xffffff,
    });

    const multStyle = new TextStyle({
      fontFamily: "Oswald, sans-serif",
      fontSize: Math.round(cellSize * 0.24),
      fontWeight: "700",
      fill: 0xffd000,
    });

    for (let r = 0; r < GRID_SIZE; r++) {
      this.tileBgs[r] = [];
      this.spriteLayers[r] = [];
      this.symbolTexts[r] = [];
      this.multTexts[r] = [];

      for (let c = 0; c < GRID_SIZE; c++) {
        const x = c * (cellSize + gap);
        const y = r * (cellSize + gap);

        const bg = new Graphics();
        bg.roundRect(x, y, cellSize, cellSize, 6);
        bg.fill({ color: 0x0b0c0e });
        bg.stroke({ width: 1, color: 0xffffff, alpha: 0.16 });
        this.root.addChild(bg);
        this.tileBgs[r][c] = bg;

        const symLabel = new Text({ text: "TRIANGLE", style: symStyle });
        symLabel.anchor.set(0.5);
        symLabel.position.set(x + cellSize / 2, y + cellSize * 0.44);
        this.root.addChild(symLabel);
        this.symbolTexts[r][c] = symLabel;
        this.spriteLayers[r][c] = null;

        const multLabel = new Text({ text: "", style: multStyle });
        multLabel.anchor.set(0.5);
        multLabel.position.set(x + cellSize / 2, y + cellSize * 0.8);
        this.root.addChild(multLabel);
        this.multTexts[r][c] = multLabel;
      }
    }
  }

  public layout(): void {
    const viewW = this.app.renderer.width;
    const viewH = this.app.renderer.height;
    const available = Math.max(240, Math.min(viewW - 24, viewH - 24));
    const scale = available / (this.boardSize + 16);

    this.root.scale.set(scale);
    this.root.position.set(
      (viewW - (this.boardSize + 16) * scale) / 2,
      (viewH - (this.boardSize + 16) * scale) / 2
    );
  }

  public updateBoard(grid: SymbolCode[][], embers: number[][], bonusTier: BonusTier): void {
    const gap = 8;
    const cellSize = (this.boardSize - gap * (GRID_SIZE - 1)) / GRID_SIZE;

    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const x = c * (cellSize + gap);
        const y = r * (cellSize + gap);
        const sym = grid[r]?.[c] ?? "L1";
        const meta = SYMBOL_MANIFEST[sym];
        const emberVal = embers[r]?.[c] ?? 0;

        const tex = this.textures[sym];
        if (tex) {
          this.symbolTexts[r][c].visible = false;
          let sp = this.spriteLayers[r][c];
          if (!sp) {
            sp = new Sprite(tex);
            sp.x = x + 4;
            sp.y = y + 4;
            sp.width = cellSize - 8;
            sp.height = cellSize - 8;
            this.root.addChildAt(sp, this.root.getChildIndex(this.multTexts[r][c]));
            this.spriteLayers[r][c] = sp;
          } else {
            sp.texture = tex;
            sp.visible = true;
          }
        } else {
          if (this.spriteLayers[r][c]) {
            this.spriteLayers[r][c]!.visible = false;
          }
          const lbl = this.symbolTexts[r][c];
          lbl.visible = true;
          lbl.text = meta.shortLabel;
          lbl.style.fill =
            meta.tier === "wild"
              ? 0xffffff
              : meta.tier === "scatter"
              ? 0xff4d4d
              : meta.tier === "high"
              ? 0xffb800
              : 0x9aa0ad;
        }

        const bg = this.tileBgs[r][c];
        bg.clear();
        bg.roundRect(x, y, cellSize, cellSize, 6);

        if (emberVal >= 16) {
          bg.fill({ color: 0x3a2400 });
          bg.stroke({ width: 2, color: 0xffd000, alpha: 0.95 });
        } else if (emberVal >= 2) {
          bg.fill({ color: 0x2b0e04 });
          bg.stroke({ width: 2, color: 0xff6a00, alpha: 0.9 });
        } else if (emberVal === 1) {
          bg.fill({ color: 0x1d0908 });
          bg.stroke({ width: 1.5, color: 0xd92626, alpha: 0.75 });
        } else {
          bg.fill({ color: 0x0b0c0e });
          bg.stroke({
            width: 1,
            color: bonusTier >= 3 ? 0xff6a00 : 0xffffff,
            alpha: bonusTier >= 3 ? 0.35 : 0.16,
          });
        }

        if (emberVal >= 2) {
          this.multTexts[r][c].text = `${emberVal}x`;
          this.multTexts[r][c].style.fill = emberVal >= 16 ? 0xfffdf5 : 0xffd000;
        } else if (emberVal === 1) {
          this.multTexts[r][c].text = "1x";
          this.multTexts[r][c].style.fill = 0xff6a00;
        } else {
          this.multTexts[r][c].text = "";
        }
      }
    }
  }
}
