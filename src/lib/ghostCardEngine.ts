// Ghost Card (Old Maid / 捉鬼牌) Protocol Engine
// Pure mechanical layer: Compact deck (17 cards), shuffle, deal, pairing, draw validation, and objective history

export interface Card {
  id: string;
  rank: string; // 'A', '2', '3', etc. or 'GHOST'
  suit: string; // '♠', '♥', '♦', '♣' or '🐾'
  isGhost: boolean;
  displayRank: string;
  displayMotif: string;
  dogArt?: string;
}

export interface DiscardedPair {
  id: string;
  rank: string;
  cards: [Card, Card];
  timestamp: number;
  discardedBy: 'user' | 'character' | 'initial';
}

export interface UserBluffHistoryItem {
  turn: number;
  userSaid: string;
  charBelieved: boolean;
  actualResult: string;
  isLie: boolean;
  timestamp: number;
}

export interface CharBluffHistoryItem {
  turn: number;
  charSaid: string;
  truthOrLie: 'truth' | 'lie';
  userDrew: string;
  timestamp: number;
}

export interface GhostCardKeyMoment {
  round: number;
  event: string;
  detail: string;
}

export const DOG_MOTIFS = ['🐾', '🐶', '🐕', '🦴', '🐩', '₍˄·͈༝·͈˄*₎', 'ᯠ_ ̫ _ᯄ', 'ฅ՞•ﻌ•՞ฅ'];
export const RANK_POOL = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

/**
 * 1. Generate Compact Deck: 8 distinct ranks * 2 + 1 Ghost Card = 17 Cards
 */
export function createCompactDeck(): Card[] {
  // Shuffle rank pool and pick 8 ranks
  const shuffledRanks = [...RANK_POOL].sort(() => Math.random() - 0.5);
  const selectedRanks = shuffledRanks.slice(0, 8);

  const deck: Card[] = [];
  const suits = ['♠', '♥', '♦', '♣'];

  selectedRanks.forEach((rank, rIdx) => {
    const motif = DOG_MOTIFS[rIdx % DOG_MOTIFS.length];
    // Card 1
    deck.push({
      id: `card_${rank}_1_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      rank,
      suit: suits[rIdx % 2],
      isGhost: false,
      displayRank: rank,
      displayMotif: motif,
    });
    // Card 2 (Pair)
    deck.push({
      id: `card_${rank}_2_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      rank,
      suit: suits[(rIdx % 2) + 2],
      isGhost: false,
      displayRank: rank,
      displayMotif: motif,
    });
  });

  // 1 Ghost Card (🐾)
  deck.push({
    id: `card_GHOST_${Date.now()}`,
    rank: 'GHOST',
    suit: '🐾',
    isGhost: true,
    displayRank: '鬼牌',
    displayMotif: '🐾',
    dogArt: '₍ᐢ •͈ ༝ •͈ ᐢ₎ 🐾',
  });

  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

/**
 * 2. Deal Initial Hands (Strict 50/50 equal probability for Ghost Card holder)
 */
export function dealInitialHands(
  deck: Card[],
  firstTurn: 'user' | 'character' = 'user'
): { userHand: Card[]; charHand: Card[]; initialGhostHolder: 'user' | 'character' } {
  // Separate ghost card and normal cards
  const ghostCard = deck.find((c) => c.isGhost);
  const normalCards = deck.filter((c) => !c.isGhost);

  // Shuffle normal cards thoroughly
  for (let i = normalCards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [normalCards[i], normalCards[j]] = [normalCards[j], normalCards[i]];
  }

  // Deal 8 normal cards to user, 8 normal cards to character
  const userHand: Card[] = normalCards.slice(0, 8);
  const charHand: Card[] = normalCards.slice(8, 16);

  // Explicit 50% / 50% fair coin flip for who initially receives the Ghost Card!
  const initialGhostHolder: 'user' | 'character' = Math.random() < 0.5 ? 'user' : 'character';

  if (ghostCard) {
    if (initialGhostHolder === 'user') {
      userHand.push(ghostCard);
    } else {
      charHand.push(ghostCard);
    }
  }

  // Shuffle each hand so ghost card isn't just at the end
  const shuffledUser = shuffleHand(userHand);
  const shuffledChar = shuffleHand(charHand);

  return { 
    userHand: shuffledUser, 
    charHand: shuffledChar, 
    initialGhostHolder 
  };
}

/**
 * 3. Auto-Discard Matching Pairs in Hand
 */
export function autoDiscardPairs(
  hand: Card[],
  discardedBy: 'user' | 'character' | 'initial' = 'initial'
): {
  remainingHand: Card[];
  discardedPairs: DiscardedPair[];
} {
  const remainingHand: Card[] = [];
  const discardedPairs: DiscardedPair[] = [];
  const rankBuckets = new Map<string, Card[]>();

  for (const card of hand) {
    if (card.isGhost) {
      remainingHand.push(card);
      continue;
    }
    const bucket = rankBuckets.get(card.rank) || [];
    bucket.push(card);
    rankBuckets.set(card.rank, bucket);
  }

  for (const [rank, bucket] of rankBuckets.entries()) {
    while (bucket.length >= 2) {
      const c1 = bucket.shift()!;
      const c2 = bucket.shift()!;
      discardedPairs.push({
        id: `pair_${rank}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        rank,
        cards: [c1, c2],
        timestamp: Date.now(),
        discardedBy,
      });
    }
    if (bucket.length === 1) {
      remainingHand.push(bucket[0]);
    }
  }

  return { remainingHand, discardedPairs };
}

/**
 * 4. Execute Draw Action (Player or Character draws from opponent)
 */
export function executeDrawCard(
  fromHand: Card[],
  toHand: Card[],
  index: number,
  drawnBy: 'user' | 'character'
): {
  newFromHand: Card[];
  newToHand: Card[];
  drawnCard: Card;
  pairedCard: Card | null;
  newDiscardedPairs: DiscardedPair[];
  isGhost: boolean;
} {
  // Safe index bounding
  const safeIdx = Math.max(0, Math.min(index, fromHand.length - 1));
  const newFromHand = [...fromHand];
  const [drawnCard] = newFromHand.splice(safeIdx, 1);

  const newToHand = [...toHand];
  const newDiscardedPairs: DiscardedPair[] = [];
  let pairedCard: Card | null = null;

  if (drawnCard.isGhost) {
    newToHand.push(drawnCard);
  } else {
    const matchIdx = newToHand.findIndex((c) => !c.isGhost && c.rank === drawnCard.rank);
    if (matchIdx !== -1) {
      pairedCard = newToHand.splice(matchIdx, 1)[0];
      newDiscardedPairs.push({
        id: `pair_${drawnCard.rank}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        rank: drawnCard.rank,
        cards: [drawnCard, pairedCard],
        timestamp: Date.now(),
        discardedBy: drawnBy,
      });
    } else {
      newToHand.push(drawnCard);
    }
  }

  return {
    newFromHand,
    newToHand,
    drawnCard,
    pairedCard,
    newDiscardedPairs,
    isGhost: drawnCard.isGhost,
  };
}

/**
 * 5. Win / Loss Checker
 * In Ghost Card:
 * - The person who empties their hand first WINS!
 * - The person left with the Ghost Card loses.
 */
export function checkGhostCardWinner(
  userHand: Card[],
  charHand: Card[]
): 'user' | 'character' | null {
  if (userHand.length === 0) return 'user';
  if (charHand.length === 0) return 'character';
  return null;
}

/**
 * 6. Shuffle an existing hand (used for "换牌/重新打乱")
 */
export function shuffleHand(hand: Card[]): Card[] {
  const newHand = [...hand];
  for (let i = newHand.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newHand[i], newHand[j]] = [newHand[j], newHand[i]];
  }
  return newHand;
}

export type TacticDirection = 'provoke' | 'plead'; // 挑逗(让它选) vs 求饶(不想让它选)

export interface CardHoverReaction {
  cardIndex: number;
  speech: string;
  action: string;
  innerThought?: string;
}
