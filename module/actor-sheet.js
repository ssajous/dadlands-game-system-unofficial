import { EntitySheetHelper } from "./helper.js";
import { ATTRIBUTE_TYPES } from "./constants.js";

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
      createItem: SimpleActorSheet._onCreateItem,
      editItem: SimpleActorSheet._onEditItem,
      deleteItem: SimpleActorSheet._onDeleteItem,
      rollItem: SimpleActorSheet._onRollItem,
      createAttribute: SimpleActorSheet._onCreateAttribute,
      deleteAttribute: SimpleActorSheet._onDeleteAttribute,
      rollAttribute: SimpleActorSheet._onRollAttribute,
      createGroup: SimpleActorSheet._onCreateGroup,
      deleteGroup: SimpleActorSheet._onDeleteGroup,
      editImage: SimpleActorSheet._onEditImage
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

  /** @override */
  static TABS = {
    primary: {
      tabs: [
        { id: "description", icon: "fa-solid fa-book", label: "Description" },
        { id: "items", icon: "fa-solid fa-suitcase", label: "Items" },
        { id: "attributes", icon: "fa-solid fa-list", label: "Attributes" }
      ],
      initial: "description",
      labelPrefix: "SIMPLE.Tab"
    }
  };

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
    context.items = Array.from(this.actor.items);

    // Enrich biography HTML
    context.biographyHTML = await foundry.applications.ux.TextEditor.implementation.enrichHTML(actorData.system.biography, {
      secrets: this.document.isOwner,
      rollData: this.actor.getRollData(),
      relativeTo: this.actor
    });

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

    // Make attribute rolls draggable for macro creation
    const html = this.element;
    html.querySelectorAll(".attributes a.attribute-roll").forEach(a => {
      a.setAttribute("draggable", true);
      a.addEventListener("dragstart", ev => {
        const dragData = { ...ev.currentTarget.dataset };
        ev.dataTransfer.setData("text/plain", JSON.stringify(dragData));
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
   * Handle creating a new Item
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The element that was clicked
   */
  static async _onCreateItem(event, target) {
    const cls = getDocumentClass("Item");
    return cls.create({ name: game.i18n.localize("SIMPLE.ItemNew"), type: "item" }, { parent: this.actor });
  }

  /**
   * Handle editing an Item
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The element that was clicked
   */
  static async _onEditItem(event, target) {
    const li = target.closest(".item");
    const item = this.actor.items.get(li?.dataset.itemId);
    if (item) return item.sheet.render(true);
  }

  /**
   * Handle deleting an Item
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The element that was clicked
   */
  static async _onDeleteItem(event, target) {
    const li = target.closest(".item");
    const item = this.actor.items.get(li?.dataset.itemId);
    if (item) return item.delete();
  }

  /**
   * Handle rolling an Item's formula
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The element that was clicked
   */
  static async _onRollItem(event, target) {
    const li = target.closest(".item");
    const item = this.actor.items.get(li?.dataset.itemId);
    const formula = target.dataset.roll;
    const label = target.dataset.label;
    const r = new Roll(formula, this.actor.getRollData());
    return r.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: `<h2>${item.name}</h2><h3>${label}</h3>`
    });
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
}
