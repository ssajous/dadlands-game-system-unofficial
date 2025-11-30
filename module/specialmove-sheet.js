const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

/**
 * Sheet for Special Move items
 * @extends {ItemSheetV2}
 */
export class SpecialMoveSheet extends HandlebarsApplicationMixin(ItemSheetV2) {

  /** Track which description field is being edited */
  _editingDescriptionTarget = null;

  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["dadlands", "sheet", "item", "specialmove"],
    position: {
      width: 450,
      height: 400
    },
    actions: {
      editImage: SpecialMoveSheet._onEditImage
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
      template: "systems/dadlands/templates/specialmove-sheet.html"
    }
  };

  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const itemData = this.item.toObject(false);

    context.item = this.item;
    context.systemData = itemData.system;
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
}
