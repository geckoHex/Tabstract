const GREETING_SEGMENTS = [
    {
        key: 'afterMidnight',
        start: 0,
        end: 1,
        messages: [
            "Midnight oil’s burning bright, {{name}}.",
            "You're either a genius or deeply unwell, {{name}}.",
            "Still up? The raccoons are your people, {{name}}.",
            "Midnight musings or just doomscrolling, {{name}}?",
            "Sleep is for mortals, {{name}}.",
            "That 2 AM clarity hitting early tonight, {{name}}."
        ]
    },
    {
        key: 'deepNight',
        start: 2,
        end: 3,
        messages: [
            "It’s suspiciously quiet, {{name}}…",
            "Only owls and coders awake right now, {{name}}.",
            "Time’s fake at this hour, {{name}}.",
            "You’ve entered the weird part of the internet, {{name}}.",
            "Even your shadow’s asleep, {{name}}.",
            "Are you coding, or plotting, {{name}}?"
        ]
    },
    {
        key: 'preDawn',
        start: 4,
        end: 5,
        messages: [
            "The sun’s still buffering, {{name}}.",
            "You’ve unlocked ‘pre-dawn’ mode, {{name}}.",
            "Only legends and bakers wake this early, {{name}}.",
            "This is the ‘quiet chaos’ hour, {{name}}.",
            "You're up before the birds even tweet, {{name}}."
        ]
    },
    {
        key: 'sunrise',
        start: 6,
        end: 7,
        messages: [
            "Sun’s clocked in, {{name}}!",
            "The world’s glowing, and so are you, {{name}}.",
            "Fresh start. Same coffee, {{name}}.",
            "Golden light. New day. Let’s go, {{name}}.",
            "Good morning, early achiever {{name}}.",
            "You beat the snooze button *and* the sun, {{name}}."
        ]
    },
    {
        key: 'morning',
        start: 8,
        end: 9,
        messages: [
            "Good morning, {{name}}!",
            "Fuel up, {{name}} — it’s chaos out there.",
            "Let’s get this bread, {{name}}.",
            "Today’s gonna be your day, {{name}} (probably).",
            "You look awake. Emotionally? Questionable, {{name}}."
        ]
    },
    {
        key: 'midMorning',
        start: 10,
        end: 11,
        messages: [
            "Double espresso time, {{name}}.",
            "Still morning somehow, {{name}}.",
            "You’re doing great. Or at least vertical, {{name}}.",
            "Morning meeting survivor, {{name}}.",
            "Brunch sounds good right about now, {{name}}."
        ]
    },
    {
        key: 'noon',
        start: 12,
        end: 12,
        messages: [
            "High noon, partner {{name}}.",
            "Lunch > life goals, {{name}}.",
            "Sun’s at its peak, motivation isn’t, {{name}}.",
            "Recharge and refuel, {{name}}.",
            "Halfway through the day, {{name}}. You’re winning."
        ]
    },
    {
        key: 'earlyAfternoon',
        start: 13,
        end: 14,
        messages: [
            "That post-lunch sleepiness is creeping in, {{name}}.",
            "Afternoon vibes: 80% chill, 20% chaos, {{name}}.",
            "Hydrate or diedrate, {{name}}.",
            "Don’t trust the clock — it’s lying, {{name}}.",
            "You’ve earned a snack, {{name}}."
        ]
    },
    {
        key: 'midAfternoon',
        start: 15,
        end: 16,
        messages: [
            "The 3PM slump approaches, {{name}}.",
            "Almost there, {{name}}. Eyes open.",
            "Grab water, stretch, survive, {{name}}.",
            "Half-asleep productivity mode activated, {{name}}.",
            "Coffee’s calling again, {{name}}."
        ]
    },
    {
        key: 'goldenHour',
        start: 17,
        end: 18,
        messages: [
            "Golden hour glow-up time, {{name}}.",
            "Sunset’s working overtime for you, {{name}}.",
            "The light’s perfect — take that selfie, {{name}}.",
            "Day’s almost done. You made it, {{name}}.",
            "Hope your evening’s as calm as this sky, {{name}}."
        ]
    },
    {
        key: 'evening',
        start: 19,
        end: 20,
        messages: [
            "Good evening, {{name}}.",
            "Dinner o’clock, {{name}}!",
            "Wrap up and wind down, {{name}}.",
            "You’ve survived another day, {{name}}.",
            "City lights and cozy vibes, {{name}}."
        ]
    },
    {
        key: 'lateEvening',
        start: 21,
        end: 22,
        messages: [
            "The day’s cooling off, {{name}}.",
            "Netflix or deep thoughts tonight, {{name}}?",
            "Late night, low light, max chill, {{name}}.",
            "The world’s slowing down, maybe you should too, {{name}}.",
            "Perfect hour for bad ideas, {{name}}."
        ]
    },
    {
        key: 'midnight',
        start: 23,
        end: 23,
        messages: [
            "It’s technically tomorrow, {{name}}.",
            "New day unlocked — go back to bed, {{name}}.",
            "Midnight thoughts loading… {{name}}.",
            "Still online? Dedication or chaos, {{name}}?",
            "The night’s yours, {{name}}."
        ]
    },
    {
        key: 'weekendMorning',
        start: 8,
        end: 10,
        messages: [
            "Weekend mornings hit different, {{name}}.",
            "No alarms, no rules, {{name}}.",
            "Sleep in? Nah, you’re here — hi {{name}}.",
            "Pancake time, {{name}}.",
            "Take it easy, {{name}} — you earned it."
        ]
    },
    {
        key: 'weekendAfternoon',
        start: 12,
        end: 17,
        messages: [
            "Weekend mode fully activated, {{name}}.",
            "No responsibilities, only vibes, {{name}}.",
            "Sunshine, snacks, serenity, {{name}}.",
            "Treat yourself day, {{name}}.",
            "Time’s fake — live it up, {{name}}."
        ]
    },
    {
        key: 'napZone',
        start: 14,
        end: 15,
        messages: [
            "Prime nap window detected, {{name}}.",
            "Close your eyes for ‘just five minutes’, {{name}}.",
            "Dreams waiting for you, {{name}}.",
            "Nap time is self-care, {{name}}.",
            "Productivity paused, {{name}}."
        ]
    },
    {
        key: 'midSnack',
        start: 22,
        end: 23,
        messages: [
            "Late-night munchies approaching, {{name}}.",
            "Fridge raid protocol activated, {{name}}.",
            "Midnight snacks count as self-care, {{name}}.",
            "Kitchen’s calling your name, {{name}}.",
            "Calories don’t exist after 10PM, {{name}}."
        ]
    },
    {
        key: 'existentialZone',
        start: 3,
        end: 4,
        messages: [
            "The universe is vast, {{name}}. And you’re awake.",
            "You’re thinking about life again, huh {{name}}?",
            "Philosopher hours begin, {{name}}.",
            "Stars out, thoughts loud, {{name}}.",
            "Reality feels optional at this time, {{name}}."
        ]
    }
];
