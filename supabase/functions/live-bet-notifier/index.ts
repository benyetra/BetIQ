// Supabase Edge Function: live-bet-notifier
// Polls live player stats and sends push notifications for tracked player prop bets.
// Deploy: supabase functions deploy live-bet-notifier
// Cron: Set up via Supabase Dashboard > Database > Extensions > pg_cron
//   SELECT cron.schedule('live-bet-notifier', '*/30 * * * * *',
//     $$SELECT net.http_post(url:='https://vmkhritosttahrrlakhn.supabase.co/functions/v1/live-bet-notifier',
//       headers:='{"Authorization": "Bearer <service_role_key>"}')$$);

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APNS_KEY_ID = Deno.env.get("APNS_KEY_ID");
const APNS_TEAM_ID = Deno.env.get("APNS_TEAM_ID");
const APNS_PRIVATE_KEY = Deno.env.get("APNS_PRIVATE_KEY");
const BUNDLE_ID = "com.yetimonstah.BetIQ";

// ESPN hidden API for live player stats
const ESPN_API_BASE = "https://site.api.espn.com/apis/site/v2/sports";

interface TrackedBet {
  id: string;
  user_id: string;
  legs: TrackedBetLeg[];
  tracking_status: string;
  stake: number;
  potential_payout: number;
  player_stats_snapshot: Record<string, PlayerStatSnapshot> | null;
}

interface TrackedBetLeg {
  id: string;
  sport: string;
  league: string;
  game_id: string;
  home_team: string;
  away_team: string;
  market_type: string;
  selection: string;
  odds: number;
  status: string;
}

interface PlayerStatSnapshot {
  player_name: string;
  stat_category: string;
  current_value: number;
  line: number;
  direction: string;
  last_notified_value: number;
  is_clinched: boolean;
  is_eliminated: boolean;
}

interface DeviceToken {
  apns_token: string;
  user_id: string;
}

// Sport mapping for ESPN API
const ESPN_SPORT_MAP: Record<string, { sport: string; league: string }> = {
  basketball_nba: { sport: "basketball", league: "nba" },
  basketball_ncaab: { sport: "basketball", league: "mens-college-basketball" },
  americanfootball_nfl: { sport: "football", league: "nfl" },
  americanfootball_ncaaf: { sport: "football", league: "college-football" },
  baseball_mlb: { sport: "baseball", league: "mlb" },
  icehockey_nhl: { sport: "hockey", league: "nhl" },
  soccer_usa_mls: { sport: "soccer", league: "usa.1" },
  soccer_epl: { sport: "soccer", league: "eng.1" },
};

// Stat category to ESPN stat key mapping
const STAT_KEY_MAP: Record<string, string[]> = {
  Points: ["points"],
  Rebounds: ["rebounds"],
  Assists: ["assists"],
  "3-Pointers Made": ["threePointFieldGoalsMade"],
  "Points + Rebounds + Assists": ["points", "rebounds", "assists"],
  Steals: ["steals"],
  Blocks: ["blocks"],
  "Passing Yards": ["passingYards"],
  "Rushing Yards": ["rushingYards"],
  "Receiving Yards": ["receivingYards"],
  "Passing TDs": ["passingTouchdowns"],
  Receptions: ["receptions"],
  Strikeouts: ["strikeouts"],
  Hits: ["hits"],
  "Home Runs": ["homeRuns"],
  RBIs: ["RBIs"],
  Goals: ["goals"],
  "Shots on Goal": ["shotsOnGoal"],
  Saves: ["saves"],
};

Deno.serve(async (_req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // 1. Fetch all live tracked bets with player prop legs
    const { data: liveBets, error: fetchError } = await supabase
      .from("tracked_bets")
      .select("*")
      .eq("tracking_status", "live");

    if (fetchError) {
      console.error("Error fetching live bets:", fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), { status: 500 });
    }

    if (!liveBets || liveBets.length === 0) {
      return new Response(JSON.stringify({ message: "No live bets to process" }), { status: 200 });
    }

    // 2. Filter to bets with player prop legs
    const propBets = liveBets.filter((bet: TrackedBet) =>
      bet.legs.some((leg) => leg.market_type === "player_prop")
    );

    if (propBets.length === 0) {
      return new Response(JSON.stringify({ message: "No player prop bets to track" }), { status: 200 });
    }

    // 3. Collect unique sports to fetch scores from
    const sportKeys = new Set<string>();
    for (const bet of propBets) {
      for (const leg of bet.legs) {
        if (leg.sport) sportKeys.add(leg.sport);
      }
    }

    // 4. Fetch live player stats from ESPN for each sport
    const playerStats: Record<string, Record<string, Record<string, number>>> = {};
    // Structure: { game_id: { player_name: { stat_key: value } } }

    for (const sportKey of sportKeys) {
      const espnMapping = ESPN_SPORT_MAP[sportKey];
      if (!espnMapping) continue;

      try {
        const scoreboardUrl = `${ESPN_API_BASE}/${espnMapping.sport}/${espnMapping.league}/scoreboard`;
        const res = await fetch(scoreboardUrl);
        if (!res.ok) continue;

        const data = await res.json();
        const events = data.events || [];

        for (const event of events) {
          const gameId = event.id;
          playerStats[gameId] = {};

          // Get boxscore for each event that has one
          for (const competition of event.competitions || []) {
            for (const competitor of competition.competitors || []) {
              for (const athlete of competitor.statistics?.[0]?.athletes || []) {
                const name = athlete.athlete?.displayName;
                if (!name) continue;

                const stats: Record<string, number> = {};
                const statLabels = competitor.statistics?.[0]?.labels || [];
                const statValues = athlete.stats || [];

                for (let i = 0; i < statLabels.length && i < statValues.length; i++) {
                  stats[statLabels[i]] = parseFloat(statValues[i]) || 0;
                }

                // Store by normalized player name
                const normalizedName = name.toLowerCase();
                playerStats[gameId] = playerStats[gameId] || {};
                playerStats[gameId][normalizedName] = stats;
              }
            }
          }
        }
      } catch (err) {
        console.error(`Error fetching ESPN stats for ${sportKey}:`, err);
      }
    }

    // 5. Process each bet — diff stats and generate notifications
    const notifications: Array<{
      user_id: string;
      bet_id: string;
      title: string;
      body: string;
      category: string;
    }> = [];

    for (const bet of propBets) {
      const snapshot: Record<string, PlayerStatSnapshot> =
        bet.player_stats_snapshot || {};

      for (const leg of bet.legs) {
        if (leg.market_type !== "player_prop") continue;

        // Parse the selection to extract player name, direction, line, category
        const parsed = parseSelection(leg.selection);
        if (!parsed) continue;

        const { playerName, direction, line, statCategory } = parsed;
        const snapshotKey = `${leg.id}`;

        // Find player stats in ESPN data
        const normalizedPlayer = playerName.toLowerCase();
        let currentValue = 0;
        let foundStats = false;

        // Search across all games for this player
        for (const gameStats of Object.values(playerStats)) {
          if (gameStats[normalizedPlayer]) {
            foundStats = true;
            const espnKeys = STAT_KEY_MAP[statCategory] || [];
            currentValue = 0;
            for (const key of espnKeys) {
              // Try various ESPN stat label formats
              const variations = [key, key.toLowerCase(), key.toUpperCase()];
              for (const variant of variations) {
                if (gameStats[normalizedPlayer][variant] !== undefined) {
                  currentValue += gameStats[normalizedPlayer][variant];
                }
              }
            }
            break;
          }
        }

        if (!foundStats) continue;

        const prevSnapshot = snapshot[snapshotKey];
        const prevValue = prevSnapshot?.last_notified_value ?? 0;
        const isClinched =
          direction === "over" ? currentValue > line : currentValue < line;
        const isEliminated =
          direction === "over" ? false : currentValue > line; // Simplified

        // Check if there's a stat change worth notifying
        if (currentValue !== prevValue) {
          const remaining =
            direction === "over"
              ? Math.max(0, Math.ceil(line) - currentValue + (line % 1 === 0.5 ? 0 : 1))
              : null;

          let notifBody: string;

          if (isClinched && !prevSnapshot?.is_clinched) {
            // Just clinched!
            notifBody = `BET WON — ${playerName} hits ${currentValue} ${statCategory.toLowerCase()}! Your ${direction === "over" ? "Over" : "Under"} ${line} is a winner!`;
          } else if (direction === "over" && currentValue > prevValue) {
            // Progress toward over
            const unit = statCategory.replace(/s$/, "").toLowerCase();
            notifBody = `${statCategory} #${Math.floor(currentValue)} — ${playerName} now has ${currentValue} ${statCategory.toLowerCase()}. ${remaining && remaining > 0 ? `${remaining} more needed for your Over ${line}.` : `Over ${line} already hit!`}`;
          } else {
            notifBody = `${playerName}: ${currentValue} ${statCategory.toLowerCase()} (line: ${direction} ${line})`;
          }

          notifications.push({
            user_id: bet.user_id,
            bet_id: bet.id,
            title: `${playerName} — ${statCategory}`,
            body: notifBody,
            category: "PROP_PROGRESS",
          });
        }

        // Update snapshot
        snapshot[snapshotKey] = {
          player_name: playerName,
          stat_category: statCategory,
          current_value: currentValue,
          line,
          direction,
          last_notified_value: currentValue,
          is_clinched: isClinched,
          is_eliminated: isEliminated,
        };
      }

      // Save updated snapshot back to Supabase
      await supabase
        .from("tracked_bets")
        .update({ player_stats_snapshot: snapshot })
        .eq("id", bet.id);

      // Log events
      for (const notif of notifications.filter((n) => n.bet_id === bet.id)) {
        await supabase.from("tracked_bet_events").insert({
          bet_id: bet.id,
          event_type: "prop_progress",
          payload: {
            title: notif.title,
            body: notif.body,
          },
        });
      }
    }

    // 6. Send push notifications via APNs
    if (notifications.length > 0) {
      // Get device tokens for each user
      const userIds = [...new Set(notifications.map((n) => n.user_id))];
      const { data: devices } = await supabase
        .from("user_devices")
        .select("user_id, apns_token")
        .in("user_id", userIds);

      if (devices && devices.length > 0) {
        for (const notif of notifications) {
          const userDevices = devices.filter(
            (d: DeviceToken) => d.user_id === notif.user_id
          );
          for (const device of userDevices) {
            try {
              await sendAPNs(device.apns_token, {
                title: notif.title,
                body: notif.body,
                category: notif.category,
                bet_id: notif.bet_id,
              });
            } catch (err) {
              console.error("APNs send error:", err);
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        processed: propBets.length,
        notifications_sent: notifications.length,
      }),
      { status: 200 }
    );
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
    });
  }
});

// Parse a selection string like "LeBron James Over 25.5 Points"
function parseSelection(selection: string): {
  playerName: string;
  direction: string;
  line: number;
  statCategory: string;
} | null {
  // Pattern: "Player Name Over/Under X.X Category"
  const match = selection.match(
    /^(.+?)\s+(Over|Under)\s+([\d.]+)\s+(.+)$/i
  );
  if (!match) return null;

  return {
    playerName: match[1].trim(),
    direction: match[2].toLowerCase(),
    line: parseFloat(match[3]),
    statCategory: match[4].trim(),
  };
}

// Send APNs push notification
async function sendAPNs(
  deviceToken: string,
  payload: {
    title: string;
    body: string;
    category: string;
    bet_id: string;
  }
) {
  if (!APNS_KEY_ID || !APNS_TEAM_ID || !APNS_PRIVATE_KEY) {
    console.log("APNs not configured, skipping push:", payload.title);
    return;
  }

  const jwt = await generateAPNsJWT();

  const apnsPayload = {
    aps: {
      alert: {
        title: payload.title,
        body: payload.body,
      },
      sound: "default",
      category: payload.category,
      "mutable-content": 1,
    },
    bet_id: payload.bet_id,
  };

  const url = `https://api.push.apple.com/3/device/${deviceToken}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `bearer ${jwt}`,
      "apns-topic": BUNDLE_ID,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    },
    body: JSON.stringify(apnsPayload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`APNs error ${response.status}: ${body}`);
  }
}

// Generate JWT for APNs authentication
async function generateAPNsJWT(): Promise<string> {
  // This is a simplified version — in production use proper ES256 signing
  // with the APNs auth key (.p8 file)
  const header = btoa(
    JSON.stringify({ alg: "ES256", kid: APNS_KEY_ID })
  ).replace(/=/g, "");
  const claims = btoa(
    JSON.stringify({
      iss: APNS_TEAM_ID,
      iat: Math.floor(Date.now() / 1000),
    })
  ).replace(/=/g, "");

  // In production, sign with the actual private key using Web Crypto API
  // For now, return a placeholder that will be replaced with proper signing
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToBuffer(APNS_PRIVATE_KEY!),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const data = new TextEncoder().encode(`${header}.${claims}`);
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    data
  );

  const sig = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(
    /=/g,
    ""
  );
  return `${header}.${claims}.${sig}`;
}

function pemToBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "");
  const binary = atob(b64);
  const buffer = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    view[i] = binary.charCodeAt(i);
  }
  return buffer;
}
