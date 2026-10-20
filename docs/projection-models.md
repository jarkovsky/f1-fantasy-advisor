# How the projection models work

The advisor has to guess how many fantasy points every driver and constructor will score at the next Grand Prix. A **projection model** is the rule it uses to make that guess. The guess then decides everything else: which team is best, which transfers are worth it, and who gets the x2 Boost.

No model can see the future. Each one looks at the points F1 Fantasy has already awarded this season and turns them into an expectation for the next race. They differ in one question: **how much should recent races count compared with the rest of the season?**

You can switch models at any time in the **Projection model** card under your team. The recommended team updates straight away, so you can compare what each model suggests. Your own team stays exactly as you saved it; only its projected points change.

Hover or tap a pick's numbers to see what they are: its projected points for the race week, split by session, the model they come from, and its price.

## The models at a glance

| Model                           | In one sentence                                                      | Pick it when                                                 |
| ------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------ |
| **Weighted recent** _(default)_ | Every race counts, but the latest ones count the most.               | You want a balanced guess. A good starting point.            |
| **Form (last 5)**               | Only the last five races count, all equally.                         | You want to follow who is in form right now.                 |
| **Season average**              | Every race this season counts the same.                              | You want a steady guess that ignores short hot/cold streaks. |
| **Custom blend**                | You choose the mix between Season average and Weighted recent.       | You have your own feel for how much form matters.            |
| **Equal PPM**                   | Points are guessed from the price alone, the same rate for everyone. | Very early in the season, or as a "trust the prices" check.  |

## One driver, five guesses

Take a made-up driver who scored these points over the first eight races, oldest first:

> 10, 12, 8, 15, 14, 25, 30, 35

The driver started slowly and has been flying lately. Here is what each model expects from them at race 9:

| Model                  | Guess for race 9 | Why                                                         |
| ---------------------- | ---------------- | ----------------------------------------------------------- |
| Season average         | **18.6**         | All eight races, averaged: 149 ÷ 8.                         |
| Weighted recent        | **23.3**         | The 35, 30 and 25 weigh most; the early races barely count. |
| Form (last 5)          | **23.8**         | Only 15, 14, 25, 30 and 35 count: 119 ÷ 5.                  |
| Custom blend (50 / 50) | **20.9**         | Halfway between Season average and Weighted recent.         |
| Equal PPM              | depends on price | Ignores their results; see below.                           |

The same driver is worth about 19 or about 24 points depending on whether you believe their season or their recent form. That difference is often enough to change the recommended team.

## Each model in more detail

### Weighted recent (the default)

Every race this season counts, but older races fade out. A race from three races ago counts half as much as the latest one. Six races ago counts a quarter, and so on.

- **Good at:** reacting to a driver or team that has genuinely improved or slipped, without throwing away the rest of the season.
- **Watch out for:** one unusually good or bad weekend still moves the guess quite a lot for a few races.

### Form (last 5)

A plain average of the last five races. Everything before that is ignored.

- **Good at:** catching momentum. Upgrades, a new car part or a confidence streak show up quickly.
- **Watch out for:** five races is a small sample. One crash or one lucky race is a fifth of the whole picture.

### Season average

A plain average of every race so far this season.

- **Good at:** steadiness. A single bad weekend doesn't make it panic.
- **Watch out for:** it is slow to notice real change. A team that improved mid-season still carries its early results.

### Custom blend

A slider between **Season average** (left) and **Weighted recent** (right). In the middle you get exactly half of each. Slide right if you think form matters more, left if you trust the long run.

### Equal PPM (points per million)

This one doesn't look at a driver's own results at all. It works out how many points the whole grid has scored per $1M of price per race. Then it gives every driver the same rate, so the guess is simply **price × that rate**. Constructors get their own rate.

For example, if all drivers together scored 2,000 points over 10 races and cost $250M in total, the rate is 2,000 ÷ 250 ÷ 10 = **0.8 points per $1M per race**. A $20M driver is then expected to score 16.

- **Good at:** the very first race, when no one has results yet (it is the only model available then). Also a useful sanity check: it shows what the market's prices alone would recommend.
- **Watch out for:** it can't tell a driver who outperforms their price from one who underperforms it.

## Things every model does the same way

- **Session by session.** Qualifying, the sprint and the race are guessed separately and then added up. On a sprint weekend, the guess includes a sprint; on a normal weekend, it doesn't.
- **Sprints are rare, so they get help.** With only a handful of sprints a season, a driver's own sprint average is shaky. The app mixes it with an estimate based on the driver's race results. After the season's first sprint, the driver's own sprint numbers count for a third of the mix. After four sprints, they count for two thirds. The more sprints have run, the more the driver's own numbers count.
- **New faces.** A driver with no races yet this season (for example, a mid-season replacement) is guessed with Equal PPM, whatever model you picked.
- **Before the first race,** there is no history, so every model falls back to Equal PPM.
- **What none of them know:** upgrades that haven't shown up in results yet, the weather, penalties, track character or the rumour mill. Treat the numbers as a well-informed starting point, not a prediction.

## What happens with the guess

Once every driver and constructor has a projected score, the advisor checks every legal team: 5 drivers and 2 constructors within your Cost Cap, 1,448,370 combinations. It doubles the best driver's points for the x2 Boost, subtracts 10 points for every transfer beyond your free ones, and recommends the team with the highest total.

Because it checks every team rather than estimating, the recommendation is the true best team for the model you picked. If two models disagree, that tells you the decision depends on whether you believe in recent form or the long run, and the choice is yours.

The model itself lives in [`lib/projections/engine.ts`](../lib/projections/engine.ts), with tests in [`engine.test.ts`](../lib/projections/engine.test.ts).
