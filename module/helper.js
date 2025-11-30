
export class EntitySheetHelper {

  static getAttributeData(data) {

    // Determine attribute type.
    for ( let attr of Object.values(data.system.attributes) ) {
      if ( attr.dtype ) {
        attr.isCheckbox = attr.dtype === "Boolean";
        attr.isResource = attr.dtype === "Resource";
        attr.isFormula = attr.dtype === "Formula";
      }
    }

    // Initialize ungrouped attributes for later.
    data.system.ungroupedAttributes = {};

    // Build an array of sorted group keys.
    const groups = data.system.groups || {};
    let groupKeys = Object.keys(groups).sort((a, b) => {
      let aSort = groups[a].label ?? a;
      let bSort = groups[b].label ?? b;
      return aSort.localeCompare(bSort);
    });

    // Iterate over the sorted groups to add their attributes.
    for ( let key of groupKeys ) {
      let group = data.system.attributes[key] || {};

      // Initialize the attributes container for this group.
      if ( !data.system.groups[key]['attributes'] ) data.system.groups[key]['attributes'] = {};

      // Sort the attributes within the group, and then iterate over them.
      Object.keys(group).sort((a, b) => a.localeCompare(b)).forEach(attr => {
        // Avoid errors if this is an invalid group.
        if ( typeof group[attr] != "object" || !group[attr]) return;
        // For each attribute, determine whether it's a checkbox or resource, and then add it to the group's attributes list.
        group[attr]['isCheckbox'] = group[attr]['dtype'] === 'Boolean';
        group[attr]['isResource'] = group[attr]['dtype'] === 'Resource';
        group[attr]['isFormula'] = group[attr]['dtype'] === 'Formula';
        data.system.groups[key]['attributes'][attr] = group[attr];
      });
    }

    // Sort the remaining attributes.
    const keys = Object.keys(data.system.attributes).filter(a => !groupKeys.includes(a));
    keys.sort((a, b) => a.localeCompare(b));
    for ( const key of keys ) data.system.ungroupedAttributes[key] = data.system.attributes[key];

    // Modify attributes on items.
    if ( data.items ) {
      data.items.forEach(item => {
        // Skip items without attributes (like specialmove)
        if ( !item.system.attributes ) return;
        // Iterate over attributes.
        for ( let [k, v] of Object.entries(item.system.attributes) ) {
          // Grouped attributes.
          if ( !v.dtype ) {
            for ( let [gk, gv] of Object.entries(v) ) {
              if ( gv.dtype ) {
                // Add label fallback.
                if ( !gv.label ) gv.label = gk;
                // Add formula bool.
                if ( gv.dtype === "Formula" ) {
                  gv.isFormula = true;
                }
                else {
                  gv.isFormula = false;
                }
              }
            }
          }
          // Ungrouped attributes.
          else {
            // Add label fallback.
            if ( !v.label ) v.label = k;
            // Add formula bool.
            if ( v.dtype === "Formula" ) {
              v.isFormula = true;
            }
            else {
              v.isFormula = false;
            }
          }
        }
      });
    }
  }

  /* -------------------------------------------- */

  /** @override */
  static onSubmit(event) {
    // Closing the form/sheet will also trigger a submit, so only evaluate if this is an event.
    if ( event.currentTarget ) {
      // Exit early if this isn't a named attribute.
      if ( (event.currentTarget.tagName.toLowerCase() === 'input') && !event.currentTarget.hasAttribute('name')) {
        return false;
      }

      let attr = false;
      // If this is the attribute key, we need to make a note of it so that we can restore focus when its recreated.
      const el = event.currentTarget;
      if ( el.classList.contains("attribute-key") ) {
        let val = el.value;
        let oldVal = el.closest(".attribute").dataset.attribute;
        let attrError = false;
        // Prevent attributes that already exist as groups.
        let groups = document.querySelectorAll('.group-key');
        for ( let i = 0; i < groups.length; i++ ) {
          if (groups[i].value === val) {
            ui.notifications.error(game.i18n.localize("SIMPLE.NotifyAttrDuplicate") + ` (${val})`);
            el.value = oldVal;
            attrError = true;
            break;
          }
        }
        // Handle value and name replacement otherwise.
        if ( !attrError ) {
          oldVal = oldVal.includes('.') ? oldVal.split('.')[1] : oldVal;
          attr = el.getAttribute('name').replace(oldVal, val);
        }
      }

      // Return the attribute key if set, or true to confirm the submission should be triggered.
      return attr ? attr : true;
    }
  }

  /* -------------------------------------------- */

  /**
   * Listen for click events on an attribute control to modify the composition of attributes in the sheet
   * @param {MouseEvent} event    The originating left click event
   */
  static async onClickAttributeControl(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const action = a.dataset.action;
    switch ( action ) {
      case "create":
        return EntitySheetHelper.createAttribute(event, this);
      case "delete":
        return EntitySheetHelper.deleteAttribute(event, this);
    }
  }

  /* -------------------------------------------- */

  /**
   * Listen for click events and modify attribute groups.
   * @param {MouseEvent} event    The originating left click event
   */
  static async onClickAttributeGroupControl(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const action = a.dataset.action;
    switch ( action ) {
      case "create-group":
        return EntitySheetHelper.createAttributeGroup(event, this);
      case "delete-group":
        return EntitySheetHelper.deleteAttributeGroup(event, this);
    }
  }

  /* -------------------------------------------- */

  /**
   * Listen for the roll button on attributes.
   * @param {MouseEvent} event    The originating left click event
   */
  static onAttributeRoll(event) {
    event.preventDefault();
    const button = event.currentTarget;
    const label = button.closest(".attribute").querySelector(".attribute-label")?.value;
    const chatLabel = label ?? button.parentElement.querySelector(".attribute-key").value;
    const shorthand = game.settings.get("worldbuilding", "macroShorthand");

    // Use the actor for rollData so that formulas are always in reference to the parent actor.
    const rollData = this.actor.getRollData();
    let formula = button.closest(".attribute").querySelector(".attribute-value")?.value;

    // If there's a formula, attempt to roll it.
    if ( formula ) {
      let replacement = null;
      if ( formula.includes('@item.') && this.item ) {
        let itemName = this.item.name.slugify({strict: true}); // Get the machine safe version of the item name.
        replacement = !!shorthand ? `@items.${itemName}.` : `@items.${itemName}.attributes.`;
        formula = formula.replace('@item.', replacement);
      }

      // Create the roll and the corresponding message
      let r = new Roll(formula, rollData);
      return r.toMessage({
        user: game.user.id,
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: `${chatLabel}`
      });
    }
  }

  /* -------------------------------------------- */

  /**
   * Return HTML for a new attribute to be applied to the form for submission.
   *
   * @param {Object} items  Keyed object where each item has a "type" and "value" property.
   * @param {string} index  Numeric index or key of the new attribute.
   * @param {string|boolean} group String key of the group, or false.
   *
   * @returns {string} Html string.
   */
  static getAttributeHtml(items, index, group = false) {
    // Initialize the HTML.
    let result = '<div style="display: none;">';
    // Iterate over the supplied keys and build their inputs (including whether they need a group key).
    for (let [key, item] of Object.entries(items)) {
      result = result + `<input type="${item.type}" name="system.attributes${group ? '.' + group : '' }.attr${index}.${key}" value="${item.value}"/>`;
    }
    // Close the HTML and return.
    return result + '</div>';
  }

  /* -------------------------------------------- */

  /**
   * Validate whether or not a group name can be used.
   * @param {string} groupName    The candidate group name to validate
   * @param {Document} document   The Actor or Item instance within which the group is being defined
   * @returns {boolean}
   */
  static validateGroup(groupName, document) {
    let groups = Object.keys(document.system.groups || {});
    let attributes = Object.keys(document.system.attributes).filter(a => !groups.includes(a));

    // Check for duplicate group keys.
    if ( groups.includes(groupName) ) {
      ui.notifications.error(game.i18n.localize("SIMPLE.NotifyGroupDuplicate") + ` (${groupName})`);
      return false;
    }

    // Check for group keys that match attribute keys.
    if ( attributes.includes(groupName) ) {
      ui.notifications.error(game.i18n.localize("SIMPLE.NotifyGroupAttrDuplicate") + ` (${groupName})`);
      return false;
    }

    // Check for reserved group names.
    if ( ["attr", "attributes"].includes(groupName) ) {
      ui.notifications.error(game.i18n.format("SIMPLE.NotifyGroupReserved", {key: groupName}));
      return false;
    }

    // Check for whitespace or periods.
    if ( groupName.match(/[\s|\.]/i) ) {
      ui.notifications.error(game.i18n.localize("SIMPLE.NotifyGroupAlphanumeric"));
      return false;
    }
    return true;
  }

  /* -------------------------------------------- */

  /**
   * Create new attributes.
   * @param {MouseEvent} event    The originating left click event
   * @param {Object} app          The form application object.
   * @private
   */
  static async createAttribute(event, app) {
    const a = event.currentTarget ?? event.target;
    const group = a.dataset.group;
    let dtype = a.dataset.dtype;
    const attrs = app.document.system.attributes;
    const groups = app.document.system.groups;

    // Determine the new attribute key for ungrouped attributes.
    let objKeys = Object.keys(attrs).filter(k => !Object.keys(groups).includes(k));
    let nk = Object.keys(attrs).length + 1;
    let newValue = `attr${nk}`;
    while ( objKeys.includes(newValue) ) {
      ++nk;
      newValue = `attr${nk}`;
    }

    // Build the update data
    const updateData = {};

    // Grouped attributes.
    if ( group ) {
      objKeys = attrs[group] ? Object.keys(attrs[group]) : [];
      nk = objKeys.length + 1;
      newValue = `attr${nk}`;
      while ( objKeys.includes(newValue) ) {
        ++nk;
        newValue = `attr${nk}`;
      }
      updateData[`system.attributes.${group}.${newValue}`] = {
        key: newValue,
        group: group,
        dtype: dtype || groups[group]?.dtype || "String"
      };
    }
    // Ungrouped attributes.
    else {
      // Choose a default dtype based on the last attribute, fall back to "String".
      if (!dtype) {
        const attrList = Object.values(attrs).filter(a => a.dtype);
        dtype = attrList.length > 0 ? attrList[attrList.length - 1].dtype : "String";
      }
      updateData[`system.attributes.${newValue}`] = {
        key: newValue,
        dtype: dtype
      };
    }

    // Update the document
    return app.document.update(updateData);
  }

  /**
   * Delete an attribute.
   * @param {MouseEvent} event    The originating left click event
   * @param {Object} app          The form application object.
   * @private
   */
  static async deleteAttribute(event, app) {
    const a = event.currentTarget ?? event.target;
    const li = a.closest(".attribute");
    if ( li ) {
      const attrKey = li.dataset.attribute;
      const updateData = {};
      updateData[`system.attributes.-=${attrKey}`] = null;
      return app.document.update(updateData);
    }
  }

  /* -------------------------------------------- */

  /**
   * Create new attribute groups.
   * @param {MouseEvent} event    The originating left click event
   * @param {Object} app          The form application object.
   * @private
   */
  static async createAttributeGroup(event, app) {
    const a = event.currentTarget ?? event.target;
    const groupInput = app.element.querySelector('.group-prefix');
    const newValue = groupInput?.value?.trim();

    // Verify the new group key is valid, and use it to create the group.
    if ( newValue && newValue.length > 0 && EntitySheetHelper.validateGroup(newValue, app.document) ) {
      const updateData = {};
      updateData[`system.groups.${newValue}`] = {
        key: newValue,
        label: "",
        dtype: "String"
      };
      return app.document.update(updateData);
    }
  }

  /* -------------------------------------------- */

  /**
   * Delete an attribute group.
   * @param {MouseEvent} event    The originating left click event
   * @param {Object} app          The form application object.
   * @private
   */
  static async deleteAttributeGroup(event, app) {
    const a = event.currentTarget ?? event.target;
    const groupContainer = a.closest(".group");
    const groupKey = groupContainer?.dataset.group;

    if ( !groupKey ) return;

    // Create a dialog to confirm group deletion.
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("SIMPLE.DeleteGroup") },
      content: `${game.i18n.localize("SIMPLE.DeleteGroupContent")} <strong>${groupKey}</strong>`,
      yes: {
        label: game.i18n.localize("Yes"),
        icon: "fas fa-trash"
      },
      no: {
        label: game.i18n.localize("No"),
        icon: "fas fa-times"
      }
    });

    if ( confirmed ) {
      const updateData = {};
      updateData[`system.groups.-=${groupKey}`] = null;
      updateData[`system.attributes.-=${groupKey}`] = null;
      return app.document.update(updateData);
    }
  }

  /* -------------------------------------------- */

  /**
   * Update attributes when updating an actor object.
   * @param {object} formData       The expanded form data object to modify.
   * @param {Document} document     The Actor or Item document within which attributes are being updated
   * @returns {object}              The updated formData object.
   */
  static updateAttributes(formData, document) {
    let groupKeys = [];

    // Handle the free-form attributes list (formData is already expanded)
    const formAttrs = formData?.system?.attributes || {};
    const attributes = Object.values(formAttrs).reduce((obj, v) => {
      let attrs = [];
      let group = null;
      // Handle attribute keys for grouped attributes.
      if ( !v["key"] ) {
        attrs = Object.keys(v);
        attrs.forEach(attrKey => {
          group = v[attrKey]['group'];
          groupKeys.push(group);
          let attr = v[attrKey];
          const k = this.cleanKey(v[attrKey]["key"] ? v[attrKey]["key"].trim() : attrKey.trim());
          delete attr["key"];
          // Add the new attribute if it's grouped, but we need to build the nested structure first.
          if ( !obj[group] ) {
            obj[group] = {};
          }
          obj[group][k] = attr;
        });
      }
      // Handle attribute keys for ungrouped attributes.
      else {
        const k = this.cleanKey(v["key"].trim());
        delete v["key"];
        // Add the new attribute only if it's ungrouped.
        if ( !group ) {
          obj[k] = v;
        }
      }
      return obj;
    }, {});

    // Remove attributes which are no longer used
    for ( let k of Object.keys(document.system.attributes) ) {
      if ( !attributes.hasOwnProperty(k) ) attributes[`-=${k}`] = null;
    }

    // Remove grouped attributes which are no longer used.
    for ( let group of groupKeys) {
      if ( document.system.attributes[group] ) {
        for ( let k of Object.keys(document.system.attributes[group]) ) {
          if ( !attributes[group].hasOwnProperty(k) ) attributes[group][`-=${k}`] = null;
        }
      }
    }

    // Update formData with processed attributes
    formData.system = formData.system || {};
    formData.system.attributes = attributes;

    return formData;
  }

  /* -------------------------------------------- */

  /**
   * Update attribute groups when updating an actor object.
   * @param {object} formData       The expanded form data object to modify.
   * @param {Document} document     The Actor or Item document within which attributes are being updated
   * @returns {object}              The updated formData object.
   */
  static updateGroups(formData, document) {
    const formGroups = formData?.system?.groups || {};
    const documentGroups = Object.keys(document.system.groups || {});

    // Identify valid groups submitted on the form
    const groups = Object.entries(formGroups).reduce((obj, [k, v]) => {
      const validGroup = documentGroups.includes(k) || this.validateGroup(k, document);
      if ( validGroup )  obj[k] = v;
      return obj;
    }, {});

    // Remove groups which are no longer used
    for ( let k of Object.keys(document.system.groups)) {
      if ( !groups.hasOwnProperty(k) ) groups[`-=${k}`] = null;
    }

    // Update formData with processed groups
    formData.system = formData.system || {};
    formData.system.groups = groups;

    return formData;
  }

  /* -------------------------------------------- */

  /**
   * @see ClientDocumentMixin.createDialog
   */
  static async createDialog(data={}, options={}) {

    // Collect data
    const documentName = this.metadata.name;
    const folders = game.folders.filter(f => (f.type === documentName) && f.displayed);
    const label = game.i18n.localize(this.metadata.label);
    const title = game.i18n.format("DOCUMENT.Create", {type: label});

    // Get all valid document types (excluding base type)
    const documentTypes = this.TYPES.filter(t => t !== CONST.BASE_DOCUMENT_TYPE);

    // Identify template documents
    const collection = game.collections.get(this.documentName);
    const templates = collection.filter(a => a.getFlag("worldbuilding", "isTemplate"));

    // Build the types object: first add all document types, then templates
    const types = {};
    for (const t of documentTypes) {
      types[t] = game.i18n.localize(`TYPES.${documentName}.${t}`);
    }
    for (let a of templates) {
      types[a.id] = `${a.name} (${game.i18n.localize("SIMPLE.Template")})`;
    }

    // Default to first document type
    const defaultType = documentTypes[0] ?? CONST.BASE_DOCUMENT_TYPE;

    // Render the document creation form
    const template = "templates/sidebar/document-create.html";
    const html = await foundry.applications.handlebars.renderTemplate(template, {
      name: data.name || game.i18n.format("DOCUMENT.New", {type: label}),
      folder: data.folder,
      folders: folders,
      hasFolders: folders.length > 1,
      type: data.type || defaultType,
      types: types,
      hasTypes: true
    });

    // Render the confirmation dialog window
    return foundry.applications.api.DialogV2.prompt({
      window: { title: title },
      content: html,
      ok: {
        label: title,
        callback: (event, button) => {
          // Get the form data
          const form = button.form;
          const fd = new foundry.applications.ux.FormDataExtended(form);
          let createData = fd.object;

          // Check if selection is a template document or a type
          const selectedValue = form.elements.type?.value;
          const templateDoc = collection.get(selectedValue);
          if (templateDoc) {
            // Merge with template data
            createData = foundry.utils.mergeObject(templateDoc.toObject(), createData);
            createData.type = templateDoc.type;
            delete createData.flags.worldbuilding.isTemplate;
          } else {
            // It's a document type, set it directly
            createData.type = selectedValue;
          }

          // Merge provided override data
          createData = foundry.utils.mergeObject(createData, data, { inplace: false });
          return this.create(createData, {renderSheet: true});
        }
      },
      rejectClose: false
    });
  }

  /* -------------------------------------------- */

  /**
   * Ensure the resource values are within the specified min and max.
   * @param {object} attrs  The Document's attributes.
   */
  static clampResourceValues(attrs) {
    const flat = foundry.utils.flattenObject(attrs);
    for ( const [attr, value] of Object.entries(flat) ) {
      const parts = attr.split(".");
      if ( parts.pop() !== "value" ) continue;
      const current = foundry.utils.getProperty(attrs, parts.join("."));
      if ( current?.dtype !== "Resource" ) continue;
      foundry.utils.setProperty(attrs, attr, Math.clamp(value, current.min || 0, current.max || 0));
    }
  }

  /* -------------------------------------------- */

  /**
   * Clean an attribute key, emitting an error if it contained invalid characters.
   * @param {string} key  The key to clean.
   * @returns {string}
   */
  static cleanKey(key) {
    const clean = key.replace(/[\s.]/g, "");
    if ( clean !== key ) ui.notifications.error("SIMPLE.NotifyAttrInvalid", { localize: true });
    return clean;
  }
}
