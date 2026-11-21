import { Application, Assets, Container, Graphics, Sprite, Texture } from "pixi.js";
import type { SymbolCode } from "../types/ember";
import { SYMBOL_MANIFEST } from "../engine/symbolManifest";

export class EmberGridStage {
  private app = new Application();
  private gridContainer = new Container();
  private textures: Partial<Record<SymbolCode, Texture>> = {};
  private cellSize = 84;
  private gap = 8;

  async init(host: HTMLElement, spriteBasePath = "./assets/symbols/"): Promise<void> {
    const dim = this.cellSize * 6 + this.gap * 7;
    await this.app.init({
      width: dim,
      height: dim,
      backgroundColor: 0x16181d,
      antialias: true,
    });
    host.appendChild(this.app.canvas);
    this.app.stage.addChild(this.gridContainer);

    for (const meta of Object.values(SYMBOL_MANIFEST)) {
      try {
        this.textures[meta.code] = await Assets.load(`${spriteBasePath}${meta.spriteFile}`);
      } catch {
        // Fallback if sprites are not yet in ./assets/symbols/
      }
    }
  }

  renderBoard(grid: SymbolCode[][], embers: number[][]): void {
    this.gridContainer.removeChildren();
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 6; c++) {
        const x = this.gap + c * (this.cellSize + this.gap);
        const y = this.gap + r * (this.cellSize + this.gap);
        const sym = grid[r][c];
        const heat = embers[r][c];

        const tile = new Graphics();
        const borderColor = heat >= 16 ? 0xffd000 : heat >= 2 ? 0xff6a00 : heat === 1 ? 0xd92626 : 0x2a2f3a;
        tile.roundRect(x, y, this.cellSize, this.cellSize, 8);
        tile.fill(0x0b0c0e);
        tile.stroke({ width: heat > 0 ? 2 : 1, color: borderColor });
        this.gridContainer.addChild(tile);

        const tex = this.textures[sym];
        if (tex) {
          const sp = new Sprite(tex);
          sp.x = x + 4;
          sp.y = y + 4;
          sp.width = this.cellSize - 8;
          sp.height = this.cellSize - 8;
          this.gridContainer.addChild(sp);
        }
      }
    }
  }
}
