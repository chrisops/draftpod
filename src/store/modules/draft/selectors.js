import _flatten from 'lodash/flatten'
import _shuffle from 'lodash/shuffle'
import _cloneDeep from 'lodash/cloneDeep'
import _omit from 'lodash/omit'
import _orderBy from 'lodash/orderBy'
import _pullAt from 'lodash/pullAt'

import * as filters from './card-filters'
import * as draftbot from './draftbot'
import * as set from './set'
import { DECK } from './constants'

const local_images = process.env.VUE_APP_LOCAL_IMAGES && 
                     process.env.NODE_ENV === 'development';

// get card image_uris (support local images for development)
export function cardImageUris(card) {
  if (local_images)
    return card.multiverse_ids.map((id) => "/images/cards/" + id + ".jpg");
  else
    return card.image_uris;
}

export function draftFormat(draft) {
  return draft.format || 'draft';
}

// get draft options (including defaults for new options introduced)
export function draftOptions(draft) {
  return {
    number_of_packs: 3,
    sealed_number_of_packs: 6,
    deck_size: 40,
    deck_list_format: 'normal',
    ...draft.options
  };
}

// get cards by type
export function cardsByType(cards) {
  return {
    creatures: cards.filter(filters.creature),
    other: cards.filter((card) => !filters.creature(card) && !filters.land(card))
  }
}


// get card types
export function cardTypes(cards) {
  let byType = cardsByType(cards);
  return {
    creatures: byType.creatures.length,
    other: byType.other.length
  }
}



export function cardColorInfo(code) {
  switch(code) {
    case 'W': return {
      code: 'W',
      name: "Plains",
      img: "/images/mana-white.svg",
      count: 0
    };
    case 'B': return {
      code: 'B',
      name: "Swamp",
      img: "/images/mana-black.svg",
      count: 0
    };
    case 'U': return {
      code: 'U',
      name: "Island",
      img: "/images/mana-blue.svg",
      count: 0
    };
    case 'R': return {
      code: 'R',
      name: "Mountain",
      img: "/images/mana-red.svg",
      count: 0
    };
    case 'G': return {
      code: 'G',
      name: "Forest",
      img: "/images/mana-green.svg",
      count: 0
    };
    case 'C':  return {
      code: 'C',
      name: "Colorless",
      img: "/images/mana-colorless.svg",
      count: 0
    };
  }
}

// count card colors 
export function cardColors(cards, includeLands = false, percentFilter = null, maxColors = null) {
  let colors = {
    W: cardColorInfo('W'),
    B: cardColorInfo('B'),
    U: cardColorInfo('U'),
    R: cardColorInfo('R'),
    G: cardColorInfo('G'),
    C: cardColorInfo('C')
  };
  for (let i=0; i<cards.length; i++) {
    let card = cards[i];
    let cardColors = card.colors || [];
    if (!includeLands && filters.land(card))
      continue;
    if (cardColors.length === 0)
      colors["C"].count++;
    else
      for (let c=0; c<cardColors.length; c++)
        colors[cardColors[c]].count++;
  }

  // get array of colors
  colors = Object.keys(colors).map(val => { return { code: val, ...colors[val] } });

  // compute percents
  let total_cards = colors.reduce((total, color) => total + color.count, 0);
  colors = colors.map(function(color) {
    return {...color, percent: total_cards > 0 ? color.count / total_cards : 0 }
  });

  // sort by frequency
  colors = colors.sort(function(a, b) {
    return b.count - a.count;
  });

  // apply filter if requested
  if (percentFilter !== null)
    colors = colors.filter((color) => color.percent > percentFilter);

  // apply maxColors if requested
  if (maxColors !== null)
    colors = colors.slice(0, maxColors);

  // return
  return colors;
}

export function playerColors(player_id, table) {
  
  // get colors
  let colors = cardColors(activeCards(player_id, table), false, 0, 2);

  // order them
  return orderColorPair(colors);

}

export function orderColorPair(colors) {
  
  // apply standard ordering
  if (colors.length === 2) {
    let standardPairs = [
      ['W', 'U'], // azorious
      ['U', 'B'], // dimir
      ['B', 'R'], // rakdos
      ['R', 'G'], // gruul
      ['G', 'W'], // selesnya
      ['W', 'B'], // orzhov
      ['U', 'R'], // izzet
      ['B', 'G'], // golgari
      ['R', 'W'], // boros
      ['G', 'U'], // simic
    ];
    for (let i = 0; i<standardPairs.length; i++) {
      let colorPair = standardPairs[i];
      if (colors[0].code === colorPair[1] && colors[1].code === colorPair[0])
        return [colors[1], colors[0]];
    }    
  } 

  // fall through to just return the colors unmodified
  return colors;
}

export function draftThumbnail(player_id, draft) {
  let player = activePlayer(player_id, draft.table);
  let active_cards = activeCards(player_id, draft.table);
  if (active_cards.length > 0)
    return cardImageUris(draftbot.pick(player.bot, active_cards, active_cards))[0];
  else 
    return null;
}

export function isStarted(table) {
  return table.start_time !== null;
}

export function hasPlayer(player_id, table) {
  return activePlayer(player_id, table) !== undefined;
}

export function playerIndex(player_id, table) {
  return table.players.findIndex((player) => player.id === player_id);
}

export function picksComplete(player_id, set_code, options, table) {
  
  if (table.picks_complete)
    return true;

  let cards_picked = activeCards(player_id, table).length;
  let total_cards = set.pack_cards(set_code, options.number_of_packs) * options.number_of_packs;
  return cards_picked >= total_cards; 
}

export function currentPick(player_id, set_code, options, table) {
  if (!table.picks_complete) {
    let cards_picked = activeCards(player_id, table).length;
    let current_pick = (cards_picked % set.pack_cards(set_code, options.number_of_packs)) + 1;
    return current_pick;
  } else {
    return 0;
  }
}

export function currentPack(player_id, set_code, options, table) {
  if (!table.picks_complete) {
    let cards_picked = activeCards(player_id, table).length;
    return Math.floor((cards_picked / set.pack_cards(set_code, options.number_of_packs))) + 1;
  } else {
    return 0;
  }
}

export function packCompleted(table) {
  // if any players still have cards to pick from then we are not complete
  for (let i = 0; i<table.players.length; i++) {
    let player = table.players[i];
    if (player.packs.length > 0 && player.packs[0].length > 0)
      return false;
  }
  // otherwise are complete
  return true;
}

export function activePlayer(player_id, table) {
  return table.players.find((player) => player.id === player_id);
}

export function activePack(player_id, table) {
  let player = activePlayer(player_id, table);
  if (player) {
    let packs = player.packs;
    if (packs.length > 0 && packs[0].length > 0)
      return packs[0];
    else
      return null;
  } else {
    return null;
  }
}

export function savedDeckNames(saved_decks) {
  let names = Object.keys(saved_decks.decks);
  names.sort();
  return names;
}

export function hostPlayerName(table) {
  return table.players[0].name;
}

export function allPlayerNames(table) {
  return table.players
    .filter((player) => player.id !== null && player.name !== null)
    .map((player) => player.name);
}

export function activeCards(player_id, table) {
  let player = activePlayer(player_id, table);
  if (player) {
    let piles = table.picks_complete ? player.deck.piles : player.picks.piles;
    return _flatten(piles.slice(0, DECK.PILES));
  } else {
    return [];
  }
}

export function deckOptions(deck) {
  let options = deck.options || {};
  return {
    compact_arrange_by_cost: false,
    ...options
  };
}

export function deckCards(deck) {
  return _flatten(deck.piles.slice(0, DECK.PILES));
} 

export function deckLandCount(deck) {
  let basic_lands = deck.lands.basic;
  return deck.piles[DECK.LANDS].length + sumValues(basic_lands);
}

export function deckTotalCards(deck) {
  return deckCards(deck).length + deckLandCount(deck);
}

export function arena60CardDeck(set_code, sealed, deck) {

  // clone the deck so we aren't mutating it directly
  deck = _cloneDeep(deck);

  // note total_cards
  let total_cards = deckTotalCards(deck);

  // look for cards that have more than 4x and eliminate them
  // (note total eliminated so it doesn't affect our proportions)
  let cardCounts = {};
  let eliminated = {
    creatures: 0,
    other: 0,
    lands: 0
  }
  for (let p = 0; p<deck.piles.length; p++) {
    let pile = deck.piles[p];
    for (let i = (pile.length-1); i >= 0; i--) {
      let card = pile[i];
      if (!cardCounts.hasOwnProperty(card.name))
        cardCounts[card.name] = 0;
      if (cardCounts[card.name] >= 4) {
        pile.splice(i, 1);
        if (p < (DECK.PILES/2))
          eliminated.creatures++;
        else if (p < DECK.PILES)
          eliminated.other++;
        else if (p === DECK.LANDS)
          eliminated.lands++;
      }
      else
        cardCounts[card.name]++;
    }
  }

  // determine card types / proportions.
  let cards = deckCards(deck);
  let card_types = cardTypes(cards);
  let creatures_pct = (card_types.creatures + eliminated.creatures) / total_cards;
  let other_pct = (card_types.other + eliminated.other) / total_cards;
  let total_land = deckLandCount(deck);
  let lands_pct = (total_land + eliminated.lands) / total_cards;
 
  // determine cards required to reach the spell/land ratio.
  const kDeckSize = 60;
  let target_non_land = Math.ceil((creatures_pct + other_pct) * kDeckSize);
  let target_land = Math.floor(lands_pct * kDeckSize);
  let target_gap = kDeckSize - (target_non_land + target_land)
  target_non_land = target_non_land + target_gap;

  // if we are using the default 23/17 ratio then this will result
  // in targets of 35/25. tweak this to 36/24
  if (target_non_land === 35 && target_land === 25) {
    target_non_land = 36;
    target_land = 24;
  }
  let total_non_land = card_types.creatures + card_types.other;
  let non_land_required = Math.max(target_non_land - total_non_land, 0);
  let land_required = Math.max(target_land - total_land, 0);
  let cards_required = non_land_required + land_required;
  let creatures_required = Math.round(creatures_pct * cards_required);
  let other_required = Math.round(other_pct * cards_required);

  // ensure that we are covering all of the required non lands (the
  // calculations above could have left us off by 1 due to rounding)
  let non_land_gap = non_land_required - (creatures_required + other_required);
  creatures_required = creatures_required + non_land_gap;

  // get cards by type 
  let eligibleCards = cardsByType(cards);

  // randomly order cards
  eligibleCards.creatures = _shuffle(eligibleCards.creatures);
  eligibleCards.other = _shuffle(eligibleCards.other);
  eligibleCards.lands = _shuffle(deck.piles[DECK.LANDS]);

  // add the cards (checking for no more than 4x)
  function addCards(availableCards, cards_required, targetPile, entirePool = false) {

    if (typeof availableCards === 'string')
      availableCards = eligibleCards[availableCards];

    let addedCards = 0;
    for (let i = 0; i<availableCards.length; i++) {
      let card = availableCards[i];
      // check for 4x limit then add
      let existingCards = cardsInDeck(card, deck, entirePool);
      if (existingCards < 4) {
        card = JSON.parse(JSON.stringify(card));
        let pileIndex = targetPile || cardDeckPileIndex(card);
        deck.piles[pileIndex].push(card);
        addedCards++;
        if (addedCards === cards_required)
          break;
      }   
    }
  }
  addCards('creatures', creatures_required);
  addCards('other', other_required);
  
  // remove any cards from the sideboard that already have 
  // 4 in the main deck
  let sideboardRemoveCards = [];
  for (let i = 0; i<deck.piles[DECK.SIDEBOARD].length; i++) {
    let card = deck.piles[DECK.SIDEBOARD][i];
    if (cardsInDeck(card, deck) >= 4)
      sideboardRemoveCards.push(i);
  }
  _pullAt(deck.piles[DECK.SIDEBOARD], sideboardRemoveCards);
  
  // ensure the sideboard is no more than 15 cards
  if (!sealed && deck.piles[DECK.SIDEBOARD].length > 15) {
    // take the highest rated 15 cards in our deck's colors
    let sideboard = orderUnplayedPile(deck, DECK.SIDEBOARD, true);
    sideboard = _orderBy(sideboard, ["rating"], ["desc"]).slice(0, 15);
    deck.piles[DECK.SIDEBOARD] = sideboard;
  } 
  // re-order sideboard
  deck.piles[DECK.SIDEBOARD] = orderUnplayedPile(deck, DECK.SIDEBOARD);
  
  // recalculate lands (keep proportion of special lands)
  let non_basic_lands = deck.piles[DECK.LANDS].length;
  let non_basic_pct = non_basic_lands / deckLandCount(deck);
  let non_basic_target = Math.round(target_land * non_basic_pct);
  let non_basic_required = Math.round(Math.max(non_basic_target - non_basic_lands, 0));
  addCards('lands', non_basic_required, DECK.LANDS);
  
  // recompute auto lands for new deck
  if (deck.lands.auto) {
    deck.lands.basic = autoLands(deck, kDeckSize, target_land);
  // manual basic lands mode: mirror that mana balance exactly
  } else {
    let basics = deck.lands.basic;
    let nonBasics = countColors(deck.piles[DECK.LANDS]);
    let colors = {
      W: nonBasics.W + basics.W,
      U: nonBasics.U + basics.U,
      B: nonBasics.B + basics.B,
      R: nonBasics.R + basics.R,
      G: nonBasics.G + basics.G,
    };
    deck.lands.basic = computeBasicLands(colors, deck.piles[DECK.LANDS], target_land)
  }
  
  // return deck 
  return deck;
}

export function arena60CardDeckList(set_code, sealed, deck) {
  let deck60 = arena60CardDeck(set_code, sealed, deck);
  return deckList(set_code, 'arena', sealed, deck60);
}

export function deckList(set_code, format, sealed, deck) {
   
  let main_deck = _flatten(deck.piles.slice(0, DECK.SIDEBOARD));
  let main_deck_list = asDeckList(set_code, format, main_deck);

  let sideboard = deck.piles[DECK.SIDEBOARD];
  if (!sealed) {
    sideboard = sideboard.slice(0,15);
  }
  let sideboard_list = asDeckList(set_code, format, sideboard);

  let basic_lands_list = null;
  if (format === 'arena') {
    let basic_lands = deckBasicLands(set_code, deck.lands);
    basic_lands_list = asDeckList(set_code, format, basic_lands);
  } else {
    let basic_lands = [];
    if (deck.lands.basic.W > 0)
      basic_lands.push(deck.lands.basic.W + ' Plains');
    if (deck.lands.basic.U > 0)
      basic_lands.push(deck.lands.basic.U + ' Island');
    if (deck.lands.basic.B > 0)
      basic_lands.push(deck.lands.basic.B + ' Swamp');
    if (deck.lands.basic.R > 0)
      basic_lands.push(deck.lands.basic.R + ' Mountain');
    if (deck.lands.basic.G > 0)
      basic_lands.push(deck.lands.basic.G + ' Forest');
    basic_lands_list = basic_lands.join('\n');
  }
  
  // return deck list w/ main deck and sideboard
  return main_deck_list +
         '\n' +  
         basic_lands_list +
         '\n\n' +
         sideboard_list;
}

function cardsInDeck(card, deck, entirePool = false) {
  let end = entirePool ? DECK.UNUSED : DECK.SIDEBOARD;
  let cards = _flatten(deck.piles.slice(0, end));
  return cards.filter(c => c.name === card.name).length;
}

// get set-specific basic lands 
function deckBasicLands(set_code, lands) {

  // generate basic lands from this set
  let cards = set.cards_cached(set_code);
  const basicLands = (code, name) => {
    return new Array(lands.basic[code])
            .fill(cards.find(card => card.name === name))
  }

  // generate for all colors
  let basic_lands = [
    ...basicLands('W', 'Plains'),
    ...basicLands('U', 'Island'),
    ...basicLands('B', 'Swamp'),
    ...basicLands('R', 'Mountain'),
    ...basicLands('G', 'Forest')
  ];

  return basic_lands;
}

// function to produce a text deck list
export function asDeckList(set_code, format, cards) {
  
  // default to just using collector number
  const fields = ["collector_number"];
  const orders = ["asc"];

  // if this is an expansion set then also use set 
  if (set.expansion_set(set_code)) {
    fields.unshift("set");
    orders.unshift("asc");
  }

  // order the cards
  let ordered_cards = _orderBy(cards, fields, orders);
  ordered_cards = ordered_cards
    .reduce((ordered_cards, card) => {
      if (!ordered_cards.hasOwnProperty(card.name)) {
        ordered_cards[card.name] = {
          count: 0,
          set: card.set,
          collector_number: card.collector_number
        };
      }
      ordered_cards[card.name].count++;
      return ordered_cards;
    }, {});

  function formatName(name) {
    return name;
  } 

  // return list
  return Object.keys(ordered_cards)
    .map((name) => {
      let card = ordered_cards[name];
      let entry  = card.count + ' ' + formatName(name);
      if (format === 'arena')
        entry = entry + ' (' + card.set.toUpperCase() + ') ' + card.collector_number;
      return entry;
    })
    .join("\n");
}


export function nextPlayerIndex(player_index, total_players, current_pack) {

  let next_player_index = 0;

  if (current_pack % 2 === 0) {

    next_player_index = player_index + 1;
    if (next_player_index >= total_players)
      next_player_index = 0;

    // pass left
  } else {

    next_player_index = player_index - 1;
    if (next_player_index < 0)
      next_player_index = total_players - 1;

  }

  return next_player_index;
}


// sum all the values within an object
export function sumValues(object) {
  return Object.keys(object)
    .map(val => object[val])
    .reduce((total, count) => total + count, 0);
}


export function cardDeckPileIndex(card, compact = false) {

  let pileIndex = null;

  if (filters.land(card)) {
    pileIndex = DECK.LANDS;
  } else {
    let offset = (compact || filters.creature(card)) ? 0 : DECK.PILES / 2;
    if (card.cmc <= 1)
      pileIndex = offset;
    else if (card.cmc >= 6)
      pileIndex = offset + 5;
    else
      pileIndex = offset + card.cmc - 1;
  }

  // return the pile index
  return pileIndex;
}

export function autoLands(deck, deck_size) {

  // get the cards in the deck
  let cards = _flatten(deck.piles.slice(0, DECK.PILES));

  // if there are no cards then return no lands
  if (cards.length === 0)
    return { R: 0, W: 0, B: 0, U: 0, G: 0 };

  // count the cards in each color
  let card_colors = countColors(cards);

  // use this to rank-order the most commonly appearing colors
  let color_ranking = rankColors(card_colors);

  // count again w/ the color_ranking
  card_colors = countColors(cards, color_ranking);

  // bump all counts by 8 to bias splashes and secondary colors up
  Object.keys(card_colors).forEach(color => {
    if (card_colors[color] > 0)
      card_colors[color] += 8;
  });

  // establish total lands required
  let total_land_cards = null;
  if (deck_size === 40)
    total_land_cards = 17;
  else if (deck_size === 60)
    total_land_cards = 24;
  else
    total_land_cards = Math.round(deck_size * 0.4);

  return computeBasicLands(card_colors, deck.piles[DECK.LANDS], total_land_cards);
}

export function computeBasicLands(card_colors, non_basic_lands, total_land_cards) {

  // compute the target number of mana sources we need in our mana base  
  let total_card_colors = sumValues(card_colors);
  
  // if there are no colors yet then return no mana
  if (total_card_colors === 0)
    return card_colors;

  let mana_targets = {};
  Object.keys(card_colors).map(color => {
    let target = (card_colors[color] / total_card_colors) * total_land_cards;
    if (target > 0)
      target = Math.max(target, 1);
    mana_targets[color] = target;
  });

  // now count existing sources of mana (e.g. dual lands)
  let lands = non_basic_lands;
  let mana_existing = countColors(lands);

  // adjust for existing mana sources 
  let mana_required = {};
  Object.keys(mana_targets).map(
    color => {
      let target = mana_targets[color];
      if (target > 0)
        // ensure at least 1 mana required (prevent total_mana_required === 0)
        mana_required[color] = Math.max(mana_targets[color] - mana_existing[color], 1);
      else
        mana_required[color] = 0;
    }
  )

  // take total after adjustment (used to calculate new % values)
  let total_mana_required = sumValues(mana_required);

  // function to yield basic lands
  let basic_lands_required = total_land_cards - lands.length;
  function basicLands(rounder) {
    let basic_lands = {};
    Object.keys(mana_required).map(function (color) {
      let lands = mana_required[color] / total_mana_required * basic_lands_required;
      if (rounder)
        lands = rounder(lands);
      basic_lands[color] = lands;
    });
    return basic_lands;
  }

  // tweak until the rounded version has the right sum
  let basic_lands = basicLands();
  let basic_lands_rounded = basicLands(Math.round);
  let basic_lands_rounded_sum = sumValues(basic_lands_rounded);
  while (basic_lands_rounded_sum != basic_lands_required) {
    let is_rounded_larger = basic_lands_rounded_sum > basic_lands_required;
    let max_difference_color = null;
    let max_difference_value = 0;
    let colors = Object.keys(basic_lands);
    for (let i = 0; i < colors.length; i++) {
      let color = colors[i];
      let difference = Math.abs(basic_lands_rounded[color] - basic_lands[color]);
      if (max_difference_value < difference) {
        if ((is_rounded_larger && basic_lands_rounded[color] > basic_lands[color]) ||
          (!is_rounded_larger && basic_lands_rounded[color] < basic_lands[color])) {
          max_difference_value = difference;
          max_difference_color = color;
        }
      }
    }
    let modify_value = is_rounded_larger ? -1 : 1;
    basic_lands_rounded[max_difference_color] += modify_value;
    basic_lands_rounded_sum += modify_value;
  }

  // return basic lands
  return basic_lands_rounded;
}

export function orderUnplayedPile(deck, pile_index, deckColorsOnly = false) {
  
  // resolve pile
  let pile = deck.piles[pile_index]

  // function to reduce colors to a single string
  const asColor = colors => {
    if (colors.length > 0)
      return colors.join();
    else
      return "C"; // colorless 
  };

  // count incidence of different colors in deck
  let colorCounts = deckCards(deck).reduce((counts, card) => {
    // ignore lands
    if (filters.land(card))
      return counts;
    // count colors
    function incrementColor(color) {
      if (!counts.hasOwnProperty(color))
        counts[color] = 0;
      counts[color] = counts[color] + 1;
    }
    card.colors.forEach(incrementColor);
    incrementColor(asColor(card.colors));
    return counts;
  }, {});

  // genereate sort fields
  let cards = pile.map((card) => { 
    return { 
      ...card, 
      creature: filters.creature(card) ? 1 : 0,
      colorTag: asColor(card.colors),
      colorOrder: colorCounts[asColor(card.colors)] || 0,
    }
  }); 

  // if it's deck colors only then filter out colorOrder === 0
  if (deckColorsOnly)
    cards = cards.filter(card => card.colorOrder > 0)

  // return sorted array of cards (w/o sort fields)
  return _orderBy(cards, 
    ["colorOrder",  "colorTag", "creature", "cmc"], 
    ["desc", "asc", "desc", "asc"]
  ).map(card => {
    return _omit(card, ["colorOrder",  "colorTag", "creature"]);
  });
}

// count colors in sets of cards
export function countColors(cards, color_ranking) {
  let all_colors = ['B', 'U', 'W', 'R', 'G'];
  let color_regex = /[BUWRG/]+(?=\})/g;
  function colorReducer(accumulator, card) {
    if (card.mana_cost !== null && card.mana_cost !== "") {
      let card_colors = card.mana_cost.match(color_regex) || [];
      for (let i = 0; i < card_colors.length; i++) {
        let card_color = card_colors[i];
        // apply ranking if we have one and are dealing w/ multiple 
        // color options to play the card
        if (color_ranking) {
          let colors = card_color.split('/');
          if (colors.length === 2) {
            // exclude split colors if we can pay for the other color in our top 2
            if (color_ranking.indexOf(colors[0]) < 2 && color_ranking.indexOf(colors[1]) >= 2)
              card_color = colors[0];
            else if (color_ranking.indexOf(colors[1]) < 2 && color_ranking.indexOf(colors[0]) >= 2)
              card_color = colors[1];
          }
        }
        for (let c = 0; c < all_colors.length; c++) {
          if (card_color.indexOf(all_colors[c]) !== -1)
            accumulator[all_colors[c]]++;
        }
      }
    } else {
      for (let i = 0; i < card.colors.length; i++)
        accumulator[card.colors[i]]++;
    }
    return accumulator;
  }

  return cards.reduce(colorReducer, { R: 0, W: 0, B: 0, U: 0, G: 0 });
}

function rankColors(card_colors) {
  return Object.keys(card_colors)
    .map((color) => { return { color: color, count: card_colors[color] } })
    .sort((a, b) => b.count - a.count)
    .map((x) => x.color);
}