let currentGreetingState = {
    segment: null,
    template: null,
    name: ''
};

let lastGreetingMinute = null;
let clockIntervalId = null;

function initializeGreeting() {
    updateGreeting(true);
}

function startClock() {
    updateClock();

    if (clockIntervalId) {
        clearInterval(clockIntervalId);
    }

    clockIntervalId = setInterval(updateClock, 1000);
}

function updateClock() {
    const clockDisplay = document.getElementById('clock');
    if (!clockDisplay) {
        return;
    }

    const now = new Date();
    clockDisplay.textContent = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

    if (lastGreetingMinute !== now.getMinutes()) {
        lastGreetingMinute = now.getMinutes();
        updateGreeting();
    }
}

function updateGreeting(force = false) {
    const greetingElement = document.getElementById('greeting');
    if (!greetingElement) {
        return;
    }

    const now = new Date();
    const activeSegment = getGreetingSegment(now.getHours());
    const settings = getSettings();
    const name = (settings.userName || '').trim();

    let templateToUse = currentGreetingState.template;

    if (
        force ||
        !templateToUse ||
        currentGreetingState.segment !== activeSegment.key ||
        currentGreetingState.name !== name
    ) {
        templateToUse = pickGreetingTemplate(activeSegment.messages, currentGreetingState.template);
    }

    const message = formatGreeting(templateToUse, name);

    if (greetingElement.textContent !== message) {
        greetingElement.textContent = message;
    }

    currentGreetingState = {
        segment: activeSegment.key,
        template: templateToUse,
        name
    };
}

function getGreetingSegment(hour) {
    const now = new Date();
    const isWeekend = [0, 6].includes(now.getDay());

    const weekendSegment = GREETING_SEGMENTS.find(
        (segment) => isWeekend && segment.key.startsWith('weekend') && hour >= segment.start && hour <= segment.end
    );
    if (weekendSegment) {
        return weekendSegment;
    }

    const segment = GREETING_SEGMENTS.find((entry) => hour >= entry.start && hour <= entry.end);
    return segment || GREETING_SEGMENTS[0];
}

function pickGreetingTemplate(messages, previousTemplate) {
    if (!messages || messages.length === 0) {
        return 'Hello{{name}}';
    }

    if (messages.length === 1) {
        return messages[0];
    }

    let template = messages[Math.floor(Math.random() * messages.length)];

    if (previousTemplate && messages.length > 1 && template === previousTemplate) {
        const alternatives = messages.filter((msg) => msg !== previousTemplate);
        if (alternatives.length > 0) {
            template = alternatives[Math.floor(Math.random() * alternatives.length)];
        }
    }

    return template;
}

function formatGreeting(template, name) {
    if (!template) {
        return name ? `Hello, ${name}.` : 'Hello.';
    }

    if (name) {
        return template.replace(/{{name}}/g, name);
    }

    let result = template;
    result = result.replace(/\s*,\s*{{name}}/g, '');
    result = result.replace(/\s*{{name}}/g, '');
    result = result.replace(/{{name}}/g, '');
    result = result.replace(/\s{2,}/g, ' ');
    result = result.replace(/\s+([!?.,])/g, '$1');
    return result.trim();
}
