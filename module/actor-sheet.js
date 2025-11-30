import { EntitySheetHelper } from "./helper.js";
import { ATTRIBUTE_TYPES } from "./constants.js";
import { openMoveDialog, openSpecialMoveDialog } from "./draw.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

/**
 * Extend the basic ActorSheetV2 with some very simple modifications
 * @extends {ActorSheetV2}
 */
export class SimpleActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {

  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["worldbuilding", "sheet", "actor"],
    position: {
      width: 600,
      height: 600
    },
    actions: {
      editItem: SimpleActorSheet._onEditItem,
      deleteItem: SimpleActorSheet._onDeleteItem,
      createSpecialMove: SimpleActorSheet._onCreateSpecialMove,
      useSpecialMove: SimpleActorSheet._onUseSpecialMove,
      createAttribute: SimpleActorSheet._onCreateAttribute,
      deleteAttribute: SimpleActorSheet._onDeleteAttribute,
      rollAttribute: SimpleActorSheet._onRollAttribute,
      createGroup: SimpleActorSheet._onCreateGroup,
      deleteGroup: SimpleActorSheet._onDeleteGroup,
      editImage: SimpleActorSheet._onEditImage,
      makeMove: SimpleActorSheet._onMakeMove,
      switchTab: SimpleActorSheet._onSwitchTab
    },
    form: {
      submitOnChange: true
    },
    window: {
      resizable: true
    }
  };

  /** @override */
  static PARTS = {
    form: {
      template: "systems/worldbuilding/templates/actor-sheet.html"
    }
  };

  /** Track active tab */
  _activeTab = "description";

  /** Track which description field is being edited */
  _editingDescriptionTarget = null;

  /** Track which special moves are expanded */
  _expandedMoves = new Set();

  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actorData = this.actor.toObject(false);

    // Process attribute data
    EntitySheetHelper.getAttributeData(actorData);

    context.actor = this.actor;
    context.systemData = actorData.system;
    context.shorthand = !!game.settings.get("worldbuilding", "macroShorthand");
    context.dtypes = ATTRIBUTE_TYPES;
    context.editable = this.isEditable;

    // Filter items by type
    const allItems = Array.from(this.actor.items);
    context.items = allItems.filter(i => i.type === "item");

    // Process special moves with expanded state and enriched descriptions
    const specialMoveItems = allItems.filter(i => i.type === "specialmove");
    context.specialMoves = await Promise.all(specialMoveItems.map(async (move) => {
      const moveData = move.toObject(false);
      moveData.isExpanded = this._expandedMoves.has(move.id);
      moveData.descriptionHTML = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        move.system.description || "",
        {
          secrets: this.document.isOwner,
          rollData: this.actor.getRollData(),
          relativeTo: move
        }
      );
      return moveData;
    }));

    // Track active tab
    context.activeTab = this._activeTab;

    // Track editing state for description
    context.editingDescriptionTarget = this._editingDescriptionTarget;

    // Enrich biography HTML
    context.biographyHTML = await foundry.applications.ux.TextEditor.implementation.enrichHTML(actorData.system.biography, {
      secrets: this.document.isOwner,
      rollData: this.actor.getRollData(),
      relativeTo: this.actor
    });

    // Raw biography value for editor (from system._source for unprocessed data)
    // In Foundry v13 with TypeDataModel, system._source contains the raw data
    context.biographyValue = this.actor.system._source?.biography ?? this.actor.system.biography ?? "";

    // Process items for display
    for (const item of context.items) {
      const itemData = item.toObject(false);
      for (let [k, v] of Object.entries(itemData.system.attributes)) {
        if (!v.dtype) {
          for (let [gk, gv] of Object.entries(v)) {
            if (gv.dtype) {
              if (!gv.label) gv.label = gk;
              gv.isFormula = gv.dtype === "Formula";
            }
          }
        } else {
          if (!v.label) v.label = k;
          v.isFormula = v.dtype === "Formula";
        }
      }
      item.systemData = itemData.system;
    }

    return context;
  }

  /* -------------------------------------------- */

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);

    const html = this.element;

    // Make attribute rolls draggable for macro creation
    html.querySelectorAll(".attributes a.attribute-roll").forEach(a => {
      a.setAttribute("draggable", true);
      a.addEventListener("dragstart", ev => {
        const dragData = { ...ev.currentTarget.dataset };
        ev.dataTransfer.setData("text/plain", JSON.stringify(dragData));
      });
    });

    // Handle edit description button clicks
    html.querySelectorAll(".editor-edit").forEach(btn => {
      btn.addEventListener("click", ev => {
        ev.preventDefault();
        ev.stopPropagation();
        const targetField = btn.dataset.target;
        if (this._editingDescriptionTarget === targetField) {
          this._editingDescriptionTarget = null;
        } else {
          this._editingDescriptionTarget = targetField;
        }
        this.render({ force: true });
      });
    });

    // Listen for prose-mirror save events to exit edit mode
    if (this._editingDescriptionTarget) {
      html.querySelectorAll("prose-mirror").forEach(editor => {
        editor.addEventListener("save", () => {
          this._editingDescriptionTarget = null;
          this.render({ force: true });
        });
      });
    }

    // Handle special move name clicks to toggle expansion
    html.querySelectorAll(".specialmove-name").forEach(name => {
      name.addEventListener("click", ev => {
        ev.preventDefault();
        ev.stopPropagation();
        const li = name.closest(".specialmove");
        const itemId = li?.dataset.itemId;
        if (itemId) {
          if (this._expandedMoves.has(itemId)) {
            this._expandedMoves.delete(itemId);
          } else {
            this._expandedMoves.add(itemId);
          }
          this.render({ force: true });
        }
      });
    });
  }

  /* -------------------------------------------- */
  /*  Action Handlers                              */
  /* -------------------------------------------- */

  /**
   * Handle editing the actor's image
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The element that was clicked
   */
  static async _onEditImage(event, target) {
    const attr = target.dataset.edit;
    const current = foundry.utils.getProperty(this.document, attr);
    const fp = new foundry.applications.apps.FilePicker.implementation({
      type: "image",
      current: current,
      callback: path => this.document.update({ [attr]: path }),
      top: this.position.top + 40,
      left: this.position.left + 10
    });
    return fp.browse();
  }

  /**
   * Handle creating a new Special Move
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The element that was clicked
   */
  static async _onCreateSpecialMove(event, target) {
    const cls = getDocumentClass("Item");
    return cls.create({ name: game.i18n.localize("SIMPLE.NewSpecialMove"), type: "specialmove" }, { parent: this.actor });
  }

  /**
   * Handle using a Special Move
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The element that was clicked
   */
  static async _onUseSpecialMove(event, target) {
    const li = target.closest(".specialmove");
    const item = this.actor.items.get(li?.dataset.itemId);
    if (item) return openSpecialMoveDialog(this.actor, item);
  }

  /**
   * Handle editing an Item or Special Move
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The element that was clicked
   */
  static async _onEditItem(event, target) {
    const li = target.closest(".item, .specialmove");
    const item = this.actor.items.get(li?.dataset.itemId);
    if (item) return item.sheet.render(true);
  }

  /**
   * Handle deleting an Item or Special Move
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The element that was clicked
   */
  static async _onDeleteItem(event, target) {
    const li = target.closest(".item, .specialmove");
    const item = this.actor.items.get(li?.dataset.itemId);
    if (item) return item.delete();
  }

  /**
   * Handle creating a new attribute
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The element that was clicked
   */
  static async _onCreateAttribute(event, target) {
    return EntitySheetHelper.createAttribute(event, this);
  }

  /**
   * Handle deleting an attribute
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The element that was clicked
   */
  static async _onDeleteAttribute(event, target) {
    return EntitySheetHelper.deleteAttribute(event, this);
  }

  /**
   * Handle rolling an attribute
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The element that was clicked
   */
  static async _onRollAttribute(event, target) {
    return EntitySheetHelper.onAttributeRoll.call(this, event);
  }

  /**
   * Handle creating an attribute group
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The element that was clicked
   */
  static async _onCreateGroup(event, target) {
    return EntitySheetHelper.createAttributeGroup(event, this);
  }

  /**
   * Handle deleting an attribute group
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The element that was clicked
   */
  static async _onDeleteGroup(event, target) {
    return EntitySheetHelper.deleteAttributeGroup(event, this);
  }

  /**
   * Handle making a Dadlands move
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The element that was clicked
   */
  static async _onMakeMove(event, target) {
    return openMoveDialog(this.actor);
  }

  /**
   * Handle switching tabs
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The element that was clicked
   */
  static async _onSwitchTab(event, target) {
    const tab = target.dataset.tab;
    if (!tab) return;

    this._activeTab = tab;

    // Update tab nav active states
    const html = this.element;
    html.querySelectorAll(".sheet-tabs .item").forEach(t => {
      t.classList.toggle("active", t.dataset.tab === tab);
    });

    // Update tab content active states
    html.querySelectorAll(".sheet-body .tab").forEach(t => {
      t.classList.toggle("active", t.dataset.tab === tab);
    });
  }

}
