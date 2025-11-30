/**
 * Data models for the Simple World-Building system
 * Defines the schema for Actor and Item types
 */

const { SchemaField, StringField, NumberField, HTMLField, ObjectField } = foundry.data.fields;

/* -------------------------------------------- */
/*  Actor Data Models                           */
/* -------------------------------------------- */

/**
 * Data model for Character actors
 */
export class CharacterData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      biography: new HTMLField({ required: false, blank: true }),
      health: new SchemaField({
        value: new NumberField({ required: true, initial: 10, integer: true }),
        min: new NumberField({ required: true, initial: 0, integer: true }),
        max: new NumberField({ required: true, initial: 10, integer: true })
      }),
      power: new SchemaField({
        value: new NumberField({ required: true, initial: 5, integer: true }),
        min: new NumberField({ required: true, initial: 0, integer: true }),
        max: new NumberField({ required: true, initial: 5, integer: true })
      }),
      law: new NumberField({ required: true, initial: 4, integer: true }),
      chaos: new NumberField({ required: true, initial: 3, integer: true }),
      clan: new StringField({ required: false, blank: true }),
      attributes: new ObjectField(),
      groups: new ObjectField()
    };
  }
}

/* -------------------------------------------- */
/*  Item Data Models                            */
/* -------------------------------------------- */

/**
 * Data model for generic Items
 */
export class ItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description: new HTMLField({ required: false, blank: true }),
      quantity: new NumberField({ required: true, initial: 1, integer: true, min: 0 }),
      weight: new NumberField({ required: true, initial: 0, min: 0 }),
      attributes: new ObjectField(),
      groups: new ObjectField()
    };
  }
}

/**
 * Data model for Special Move items
 */
export class SpecialMoveData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description: new HTMLField({ required: false, blank: true }),
      approach: new StringField({ required: true, initial: "law", choices: ["law", "chaos"] })
    };
  }
}

/* -------------------------------------------- */
/*  Configuration Export                        */
/* -------------------------------------------- */

export const actorDataModels = {
  character: CharacterData
};

export const itemDataModels = {
  item: ItemData,
  specialmove: SpecialMoveData
};
