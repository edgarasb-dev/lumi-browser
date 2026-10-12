import { Menu } from "electron";
import { createAppMenu } from "./menu/items/app";
import { createArchiveMenu } from "./menu/items/archive";
import { createEditMenu } from "./menu/items/edit";
import { createFileMenu } from "./menu/items/file";
import { createSpacesMenu } from "./menu/items/spaces";
import { createTabsMenu } from "./menu/items/tabs";
import { createViewMenu } from "./menu/items/view";
import { createWindowMenu } from "./menu/items/window";
import { MenuItem, MenuItemConstructorOptions } from "electron";
import { shortcutsEmitter } from "@/saving/shortcuts";
import { recentlyClosedManager } from "@/controllers/tabs-controller/recently-closed-manager";
import { spacesController } from "@/controllers/spaces-controller";
import { windowsController } from "@/controllers/windows-controller";

class AppMenuController {
  private renderTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.render = this.render.bind(this);
    this.scheduleRender = this.scheduleRender.bind(this);

    this.scheduleRender();

    spacesController.on("space-created", this.scheduleRender);
    spacesController.on("space-updated", this.scheduleRender);
    spacesController.on("space-deleted", this.scheduleRender);

    shortcutsEmitter.on("shortcuts-changed", this.scheduleRender);
    recentlyClosedManager.on("changed", this.scheduleRender);

    // This module hasn't loaded yet, so we have to wait
    setImmediate(() => {
      windowsController.on("window-focused", this.scheduleRender);
    });
  }

  public scheduleRender() {
    if (this.renderTimeout) clearTimeout(this.renderTimeout);
    this.renderTimeout = setTimeout(() => {
      this.render();
    }, 50);
  }

  public async render() {
    const isMac = process.platform === "darwin";

    const template: Array<MenuItemConstructorOptions | MenuItem> = [
      ...(isMac ? [createAppMenu()] : []),
      createFileMenu(),
      createEditMenu(),
      createViewMenu(),
      await createSpacesMenu(),
      createTabsMenu(),
      createArchiveMenu(),
      createWindowMenu()
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }
}

export const appMenuController = new AppMenuController();
