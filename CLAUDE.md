# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the Simple World-Building System for Foundry VTT - a minimalist game system that provides configurable Actor and Item templates to support free-form, system-agnostic gameplay.

## Build Commands

```bash
npm install          # Install dependencies (gulp, gulp-less)
npm run css          # Compile LESS to CSS once
npm run watch        # Watch LESS files and recompile on changes
```

## Architecture

Foundry provides the following documentation for building game systems: https://foundryvtt.com/article/system-development/

That documentation along with any other documentation linked from it MUST be followed while building the system.

When determining patterns and practices on how to interact with Foundry apis and modules, and generally how to build a working game system, use the dnd5e game system as an example. The code for the dnd5e game system is here: https://github.com/foundryvtt/dnd5e

### Core Module Structure (`module/`)

- **simple.js** - Main entry point. Registers the system with Foundry VTT via hooks, sets up document classes, sheets, and system settings (macroShorthand, initFormula).

- **actor.js / item.js** - Extend Foundry's Actor and Item documents. Key features:
  - Template system: Any Actor/Item can be flagged as a template (`isTemplate` flag) and used to create new documents with the same attributes
  - Dynamic attribute system with support for grouped and ungrouped attributes
  - `getRollData()` in SimpleActor handles formula replacement with shorthand/longhand syntax

- **actor-sheet.js / item-sheet.js** - Sheet implementations extending ActorSheet/ItemSheet. Handle attribute management UI, item controls, and roll functionality.

- **helper.js** - `EntitySheetHelper` contains shared logic for:
  - Attribute CRUD operations (create, delete attributes and groups)
  - Form data processing (`updateAttributes`, `updateGroups`)
  - Template creation dialogs
  - Resource value clamping

- **token.js** - Custom Token and TokenDocument classes for resource bar handling

- **macro.js** - Hotbar macro creation for attribute rolls

### Code Cleanliness

MUST use the advantages of the LESS css system. 
  - Use variables and mixins whenever possible to keep the code DRY. 
  - Use different less files and imports to keep styling separate for different components. 

Code MUST adhere to SOLID design principals. Single responsibility and proper decoupling are critical. Code structure MUST group things by functional component (i.e. draw system) rather than just the type of of component (i.e. mixins, or templates).

### Attribute System

Attributes support multiple data types defined in `constants.js`:
- String, Number, Boolean, Formula, Resource

Attributes can be:
- **Ungrouped**: Top-level attributes on an Actor/Item
- **Grouped**: Nested under named groups for organization

Formula attributes support `@` syntax for referencing other attributes. When `macroShorthand` setting is enabled, formulas use simplified paths (e.g., `@strength`) vs full paths (e.g., `@attributes.strength.value`).

### Templates

HTML templates in `templates/` use Handlebars:
- `actor-sheet.html`, `item-sheet.html` - Main sheet layouts
- `parts/sheet-attributes.html`, `parts/sheet-groups.html` - Partials for attribute rendering

### Styles

LESS source in `styles/simple.less` compiles to `styles/simple.css` via gulp.

