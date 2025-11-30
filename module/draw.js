/**
 * Dadlands Draw System
 * Handles the token draw mechanics for Dadlands RPG moves
 */

/**
 * Open the Make a Move dialog for a given actor
 * @param {SimpleActor} actor The actor making the move
 */
export async function openMoveDialog(actor) {
  const content = await renderMoveDialogContent(actor);

  return foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize("SIMPLE.MakeMove") },
    content: content,
    buttons: [
      {
        action: "draw",
        label: game.i18n.localize("SIMPLE.Draw"),
        icon: "fas fa-dice",
        callback: (event, button) => {
          const form = button.form;
          const approach = form.elements.approach.value;
          const difficulty = parseInt(form.elements.difficulty.value) || 1;
          const isDifficult = form.elements.isDifficult?.checked || false;
          const isDefining = form.elements.isDefining?.checked || false;
          return executeMove(actor, approach, difficulty, isDifficult, isDefining);
        }
      },
      {
        action: "cancel",
        label: game.i18n.localize("Cancel"),
        icon: "fas fa-times"
      }
    ],
    default: "draw",
    rejectClose: false
  });
}

/**
 * Open the Use Special Move dialog for a given actor and special move
 * @param {SimpleActor} actor The actor making the move
 * @param {SimpleItem} specialMove The special move being used
 */
export async function openSpecialMoveDialog(actor, specialMove) {
  const content = await renderSpecialMoveDialogContent(actor, specialMove);

  return foundry.applications.api.DialogV2.wait({
    window: { title: `${game.i18n.localize("SIMPLE.UseMove")}: ${specialMove.name}` },
    content: content,
    buttons: [
      {
        action: "draw",
        label: game.i18n.localize("SIMPLE.Draw"),
        icon: "fas fa-dice",
        callback: (event, button) => {
          const form = button.form;
          const approach = specialMove.system.approach;
          const difficulty = parseInt(form.elements.difficulty.value) || 1;
          const isDifficult = form.elements.isDifficult?.checked || false;
          const isDefining = form.elements.isDefining?.checked || false;
          return executeMove(actor, approach, difficulty, isDifficult, isDefining, specialMove);
        }
      },
      {
        action: "cancel",
        label: game.i18n.localize("Cancel"),
        icon: "fas fa-times"
      }
    ],
    default: "draw",
    rejectClose: false
  });
}

/**
 * Render the content for the move dialog
 * @param {SimpleActor} actor The actor making the move
 * @returns {string} HTML content for the dialog
 */
async function renderMoveDialogContent(actor) {
  const maxDifficulty = actor.system.law + actor.system.chaos;

  return `
    <form class="dadlands-move-form">
      <div class="form-group">
        <label>${game.i18n.localize("SIMPLE.Approach")}</label>
        <div class="approach-options">
          <label class="approach-option">
            <input type="radio" name="approach" value="law" checked />
            <span class="approach-label law">${game.i18n.localize("SIMPLE.Law")} (${actor.system.law})</span>
          </label>
          <label class="approach-option">
            <input type="radio" name="approach" value="chaos" />
            <span class="approach-label chaos">${game.i18n.localize("SIMPLE.Chaos")} (${actor.system.chaos})</span>
          </label>
        </div>
      </div>
      <div class="form-group">
        <label>${game.i18n.localize("SIMPLE.Difficulty")}</label>
        <input type="number" name="difficulty" value="1" min="1" max="${maxDifficulty}" />
        <p class="hint">${game.i18n.localize("SIMPLE.DifficultyHint")}</p>
      </div>
      <div class="form-group">
        <label class="checkbox">
          <input type="checkbox" name="isDifficult" />
          ${game.i18n.localize("SIMPLE.DifficultChallenge")}
        </label>
        <p class="hint">${game.i18n.localize("SIMPLE.DifficultHint")}</p>
      </div>
      <div class="form-group">
        <label class="checkbox">
          <input type="checkbox" name="isDefining" />
          ${game.i18n.localize("SIMPLE.DefiningMoment")}
        </label>
        <p class="hint">${game.i18n.localize("SIMPLE.DefiningHint")}</p>
      </div>
    </form>
  `;
}

/**
 * Render the content for the special move dialog
 * @param {SimpleActor} actor The actor making the move
 * @param {SimpleItem} specialMove The special move being used
 * @returns {string} HTML content for the dialog
 */
async function renderSpecialMoveDialogContent(actor, specialMove) {
  const maxDifficulty = actor.system.law + actor.system.chaos;
  const approach = specialMove.system.approach;
  const approachLabel = approach === "law" ? game.i18n.localize("SIMPLE.Law") : game.i18n.localize("SIMPLE.Chaos");
  const approachCount = approach === "law" ? actor.system.law : actor.system.chaos;

  return `
    <form class="dadlands-move-form">
      <div class="form-group">
        <label>${game.i18n.localize("SIMPLE.Approach")}</label>
        <div class="approach-fixed">
          <span class="approach-label ${approach}">${approachLabel} (${approachCount})</span>
        </div>
      </div>
      <div class="form-group">
        <label>${game.i18n.localize("SIMPLE.Difficulty")}</label>
        <input type="number" name="difficulty" value="1" min="1" max="${maxDifficulty}" />
        <p class="hint">${game.i18n.localize("SIMPLE.DifficultyHint")}</p>
      </div>
      <div class="form-group">
        <label class="checkbox">
          <input type="checkbox" name="isDifficult" />
          ${game.i18n.localize("SIMPLE.DifficultChallenge")}
        </label>
        <p class="hint">${game.i18n.localize("SIMPLE.DifficultHint")}</p>
      </div>
      <div class="form-group">
        <label class="checkbox">
          <input type="checkbox" name="isDefining" />
          ${game.i18n.localize("SIMPLE.DefiningMoment")}
        </label>
        <p class="hint">${game.i18n.localize("SIMPLE.DefiningHint")}</p>
      </div>
    </form>
  `;
}

/**
 * Execute a move by drawing tokens and determining the outcome
 * @param {SimpleActor} actor The actor making the move
 * @param {string} approach "law" or "chaos"
 * @param {number} difficulty Number of tokens to draw
 * @param {boolean} isDifficult Whether this is a difficult challenge
 * @param {boolean} isDefining Whether this is a defining moment
 * @param {SimpleItem|null} specialMove The special move being used, if any
 */
async function executeMove(actor, approach, difficulty, isDifficult, isDefining, specialMove = null) {
  const law = actor.system.law;
  const chaos = actor.system.chaos;
  const totalTokens = law + chaos;

  // Validate difficulty
  if (difficulty > totalTokens) {
    ui.notifications.warn(game.i18n.localize("SIMPLE.NotEnoughTokens"));
    return;
  }

  // Create the token pool
  const pool = [];
  for (let i = 0; i < law; i++) pool.push("law");
  for (let i = 0; i < chaos; i++) pool.push("chaos");

  // Shuffle and draw
  const shuffled = shuffleArray([...pool]);
  const drawn = shuffled.slice(0, difficulty);

  // Count results
  const lawDrawn = drawn.filter(t => t === "law").length;
  const chaosDrawn = drawn.filter(t => t === "chaos").length;
  const matchingCount = approach === "law" ? lawDrawn : chaosDrawn;
  const nonMatchingCount = approach === "law" ? chaosDrawn : lawDrawn;

  // Determine outcome
  let outcome;
  let tokenChange = { law: 0, chaos: 0 };
  let outcomeMessage;

  if (matchingCount === difficulty) {
    // All tokens match - Success, add one token
    outcome = "success";
    tokenChange[approach] = 1;
    outcomeMessage = game.i18n.localize("SIMPLE.OutcomeSuccess");
  } else if (nonMatchingCount === difficulty) {
    // No tokens match - Failure, discard one drawn token
    outcome = "failure";
    // Discard one of the non-matching tokens
    const discardType = approach === "law" ? "chaos" : "law";
    tokenChange[discardType] = -1;
    outcomeMessage = game.i18n.localize("SIMPLE.OutcomeFailure");
  } else {
    // Mixed result
    if (isDifficult) {
      // Difficult challenge - fail on mixed, but choose which to discard
      outcome = "mixed_fail";
      outcomeMessage = game.i18n.localize("SIMPLE.OutcomeMixedFail");
    } else {
      // Normal - succeed on mixed, but choose which to discard
      outcome = "mixed_success";
      outcomeMessage = game.i18n.localize("SIMPLE.OutcomeMixedSuccess");
    }
  }

  // Handle defining moment failure
  if (isDefining && (outcome === "failure" || outcome === "mixed_fail")) {
    // Lose ALL drawn tokens
    tokenChange.law = -lawDrawn;
    tokenChange.chaos = -chaosDrawn;
    outcomeMessage += " " + game.i18n.localize("SIMPLE.DefiningFailure");
  }

  // For mixed results, prompt user to choose which token to discard
  if (outcome === "mixed_success" || outcome === "mixed_fail") {
    if (!isDefining) {
      const choice = await promptTokenDiscard(lawDrawn, chaosDrawn);
      if (choice) {
        tokenChange[choice] = -1;
      }
    }
  }

  // Calculate new values, ensuring minimums and maximums
  let maxTokensReached = false;
  if (tokenChange.law > 0 || tokenChange.chaos > 0) {
    if ((law + chaos) >= 10) {
      tokenChange.law = 0;
      tokenChange.chaos = 0;
      maxTokensReached = true;
    }
  }

  let newLaw = Math.max(0, law + tokenChange.law);
  let newChaos = Math.max(0, chaos + tokenChange.chaos);

  // Check for character failure conditions
  let characterFailed = false;
  let failureType = null;
  if (newLaw <= 0) {
    characterFailed = true;
    failureType = "deadbeat";
    newLaw = 0;
  }
  if (newChaos <= 0) {
    characterFailed = true;
    failureType = failureType ? "both" : "hardass";
    newChaos = 0;
  }

  // Update actor
  await actor.update({
    "system.law": newLaw,
    "system.chaos": newChaos
  });

  // Build chat message
  const chatContent = buildChatMessage(actor, approach, difficulty, drawn, outcome, outcomeMessage,
    tokenChange, newLaw, newChaos, isDifficult, isDefining, characterFailed, failureType, specialMove, maxTokensReached);

  // Post to chat
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: actor }),
    content: chatContent,
    type: CONST.CHAT_MESSAGE_STYLES.OTHER
  });

  return { outcome, drawn, tokenChange, characterFailed, failureType };
}

/**
 * Prompt the user to choose which token type to discard on mixed results
 * @param {number} lawDrawn Number of law tokens drawn
 * @param {number} chaosDrawn Number of chaos tokens drawn
 * @returns {Promise<string|null>} "law", "chaos", or null if cancelled
 */
async function promptTokenDiscard(lawDrawn, chaosDrawn) {
  return foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize("SIMPLE.ChooseDiscard") },
    content: `
      <p>${game.i18n.localize("SIMPLE.ChooseDiscardPrompt")}</p>
      <p>${game.i18n.localize("SIMPLE.Drawn")}: ${lawDrawn} ${game.i18n.localize("SIMPLE.Law")}, ${chaosDrawn} ${game.i18n.localize("SIMPLE.Chaos")}</p>
    `,
    buttons: [
      {
        action: "law",
        label: `${game.i18n.localize("SIMPLE.DiscardLaw")}`,
        icon: "fas fa-balance-scale",
        callback: () => "law"
      },
      {
        action: "chaos",
        label: `${game.i18n.localize("SIMPLE.DiscardChaos")}`,
        icon: "fas fa-random",
        callback: () => "chaos"
      }
    ],
    rejectClose: false
  });
}

/**
 * Build the chat message HTML for a move result
 * @param {SimpleItem|null} specialMove The special move being used, if any
 * @param {boolean} maxTokensReached Whether the 10-token cap was hit
 */
function buildChatMessage(actor, approach, difficulty, drawn, outcome, outcomeMessage,
  tokenChange, newLaw, newChaos, isDifficult, isDefining, characterFailed, failureType, specialMove = null, maxTokensReached = false) {

  const lawDrawn = drawn.filter(t => t === "law").length;
  const chaosDrawn = drawn.filter(t => t === "chaos").length;

  // Determine the move title
  const moveTitle = specialMove
    ? `${actor.name} - ${specialMove.name}`
    : `${actor.name} - ${game.i18n.localize("SIMPLE.MakeMove")}`;

  // Build move description HTML (for special moves only)
  const moveDescription = specialMove?.system?.description
    ? `<div class="move-description">${specialMove.system.description}</div>`
    : "";

  // Build token visual
  let tokenVisual = drawn.map(t =>
    `<span class="chat-token ${t}-token" title="${t === 'law' ? game.i18n.localize('SIMPLE.Law') : game.i18n.localize('SIMPLE.Chaos')}"></span>`
  ).join('');

  // Outcome class for styling
  const outcomeClass = outcome.includes("success") ? "success" : "failure";

  // Build change text
  let changeText = "";
  if (tokenChange.law !== 0) {
    const sign = tokenChange.law > 0 ? "+" : "";
    changeText += `${game.i18n.localize("SIMPLE.Law")}: ${sign}${tokenChange.law} `;
  }
  if (tokenChange.chaos !== 0) {
    const sign = tokenChange.chaos > 0 ? "+" : "";
    changeText += `${game.i18n.localize("SIMPLE.Chaos")}: ${sign}${tokenChange.chaos}`;
  }

  // Character failure warning
  let failureWarning = "";
  if (characterFailed) {
    const failureLabel = failureType === "hardass"
      ? game.i18n.localize("SIMPLE.BecameHardass")
      : failureType === "deadbeat"
        ? game.i18n.localize("SIMPLE.BecameDeadbeat")
        : game.i18n.localize("SIMPLE.CharacterFailed");
    failureWarning = `<div class="character-failed">${failureLabel}</div>`;
  }

  // Build max tokens indicator
  const maxTokensIndicator = maxTokensReached
    ? ` <span class="max-tokens-reached">${game.i18n.localize("SIMPLE.MaxTokensReached")}</span>`
    : "";

  return `
    <div class="dadlands-move-result">
      <h3>${moveTitle}</h3>
      ${moveDescription}
      <div class="move-details">
        <div><strong>${game.i18n.localize("SIMPLE.Approach")}:</strong>
          <span class="approach-badge ${approach}">${approach === "law" ? game.i18n.localize("SIMPLE.Law") : game.i18n.localize("SIMPLE.Chaos")}</span>
        </div>
        <div><strong>${game.i18n.localize("SIMPLE.Difficulty")}:</strong> ${difficulty}</div>
        ${isDifficult ? `<div class="challenge-tag difficult">${game.i18n.localize("SIMPLE.DifficultChallenge")}</div>` : ""}
        ${isDefining ? `<div class="challenge-tag defining">${game.i18n.localize("SIMPLE.DefiningMoment")}</div>` : ""}
      </div>
      <div class="tokens-drawn">
        <strong>${game.i18n.localize("SIMPLE.TokensDrawn")}:</strong>
        <div class="token-visual">${tokenVisual}</div>
        <span>(${lawDrawn} ${game.i18n.localize("SIMPLE.Law")}, ${chaosDrawn} ${game.i18n.localize("SIMPLE.Chaos")})</span>
      </div>
      <div class="outcome ${outcomeClass}">
        <strong>${game.i18n.localize("SIMPLE.Outcome")}:</strong> ${outcomeMessage}
      </div>
      <div class="token-change">
        <strong>${game.i18n.localize("SIMPLE.TokenChange")}:</strong> ${changeText || game.i18n.localize("SIMPLE.NoChange")}
      </div>
      <div class="new-totals">
        <strong>${game.i18n.localize("SIMPLE.NewTotals")}:</strong>
        ${game.i18n.localize("SIMPLE.Law")}: ${newLaw}, ${game.i18n.localize("SIMPLE.Chaos")}: ${newChaos}${maxTokensIndicator}
      </div>
      ${failureWarning}
    </div>
  `;
}

/**
 * Fisher-Yates shuffle algorithm
 * @param {Array} array The array to shuffle
 * @returns {Array} Shuffled array
 */
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
