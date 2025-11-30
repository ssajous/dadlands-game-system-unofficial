import { EntitySheetHelper } from "./helper.js";
import { ATTRIBUTE_TYPES } from "./constants.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

/**
 * Extend the basic ItemSheetV2 with some very simple modifications
 * @extends {ItemSheetV2}
 */
export class SimpleItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {

  /** Track which description field is being edited */
  _editingDescriptionTarget = null;

  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["dadlands", "sheet", "item"],
    position: {
      width: 520,
      height: 480
    },
    actions: {
      createAttribute: SimpleItemSheet._onCreateAttribute,
      deleteAttribute: SimpleItemSheet._onDeleteAttribute,
      rollAttribute: SimpleItemSheet._onRollAttribute,
      createGroup: SimpleItemSheet._onCreateGroup,
      deleteGroup: SimpleItemSheet._onDeleteGroup,
      editImage: SimpleItemSheet._onEditImage
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
      template: "systems/dadlands/templates/item-sheet.html"
    }
  };

  /** @override */
  static TABS = {
    primary: {
      tabs: [
        { id: "description", icon: "fa-solid fa-book", label: "Description" },
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
    const itemData = this.item.toObject(false);

    // Process attribute data
    EntitySheetHelper.getAttributeData(itemData);

    context.item = this.item;
    context.systemData = itemData.system;
    context.dtypes = ATTRIBUTE_TYPES;
    context.editable = this.isEditable;

    // Track editing state for description
    context.editingDescriptionTarget = this._editingDescriptionTarget;

    // Enrich description HTML
    context.descriptionHTML = await foundry.applications.ux.TextEditor.implementation.enrichHTML(itemData.system.description, {
      secrets: this.document.isOwner,
      rollData: this.item.getRollData?.() ?? {},
      relativeTo: this.item
    });

    // Raw description value for editor (from system._source for unprocessed data)
    // In Foundry v13 with TypeDataModel, system._source contains the raw data
    context.descriptionValue = this.item.system._source?.description ?? this.item.system.description ?? "";

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
  }

  /* -------------------------------------------- */
  /*  Action Handlers                              */
  /* -------------------------------------------- */

  /**
   * Handle editing the item's image
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
