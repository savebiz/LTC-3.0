export interface ProgramSession {
    id: string;
    title: string;
    minister?: string;
    venue: 'Main stage' | 'Auditorium' | 'Outdoor red carpet' | 'Indoor Studio' | 'Dept';
    venueDisplay: string;
    duration: string;
    durationMinutes: number;
    startTime: string; // "HH:mm" in 24h format for parsing
    endTime: string;   // "HH:mm" in 24h format for parsing
    timeDisplay: string; // "8:00am - 8:30am"
    isInteractive?: boolean;
    interactiveType?: 'confession' | 'qa';
    category?: 'general' | 'worship' | 'keynote' | 'activity' | 'studio';
    description?: string;
}

export interface LiveProgramState {
    active_session_id: string | null;
    delay_minutes: number;
    ticker_message: string;
    updated_at: string;
    is_live_override: boolean;
}

export const DEFAULT_LIVE_PROGRAM_STATE: LiveProgramState = {
    active_session_id: null,
    delay_minutes: 0,
    ticker_message: "",
    updated_at: new Date().toISOString(),
    is_live_override: false
};

export const TIME_CONFESSION = {
    title: "T.I.M.E. Declarations & Confessions",
    scripture: "Romans 12:2, 2 Corinthians 3:18",
    paragraphs: [
        "I am The Incredible Me, Evolving daily by the Spirit of the Lord.",
        "I refuse to be conformed to the patterns and limitations of this world; I am continually transformed by the daily renewing of my mind.",
        "My mind is sharp, my spirit is alive, and my future is radiant.",
        "I step forward in divine wisdom, unshakeable boldness, and kingdom excellence in my academics, my talents, and my calling.",
        "As I behold God's glory, I am continually changed from glory to glory, into His very likeness.",
        "I Evolve. I Excel. I Dominate. I Lead.",
        "In Jesus' mighty name — Amen!"
    ]
};

export const PROGRAM_SCHEDULE: ProgramSession[] = [
    {
        id: "workers_meeting",
        title: "Workers & Volunteers Meeting",
        minister: "Workers, Teachers & Coordinators",
        venue: "Auditorium",
        venueDisplay: "Auditorium",
        duration: "30 mins",
        durationMinutes: 30,
        startTime: "08:00",
        endTime: "08:30",
        timeDisplay: "8:00am - 8:30am",
        category: "activity",
        description: "Coordination, prayer, and morning deployment for all teams."
    },
    {
        id: "setup_briefing",
        title: "Preparations, Setup & Dept Briefing",
        minister: "Department Teams",
        venue: "Dept",
        venueDisplay: "Department Desks",
        duration: "60 mins",
        durationMinutes: 60,
        startTime: "08:30",
        endTime: "09:30",
        timeDisplay: "8:30am - 9:30am",
        category: "activity",
        description: "Equipment final checks, ushering lineup, and hall readiness."
    },
    {
        id: "red_carpet",
        title: "Red Carpet & Live Interviews",
        minister: "Red Carpet Hosts & Media Team",
        venue: "Outdoor red carpet",
        venueDisplay: "Outdoor Red Carpet",
        duration: "30 mins",
        durationMinutes: 30,
        startTime: "09:00",
        endTime: "09:30",
        timeDisplay: "9:00am - 9:30am",
        category: "studio",
        description: "Arrival photo ops, red carpet delegate interviews, and media capture."
    },
    {
        id: "studio_opening",
        title: "Studio Opening",
        minister: "Studio Anchors",
        venue: "Indoor Studio",
        venueDisplay: "Indoor Studio",
        duration: "15 mins",
        durationMinutes: 15,
        startTime: "09:30",
        endTime: "09:45",
        timeDisplay: "9:30am - 9:45am",
        category: "studio",
        description: "Official live broadcast broadcast kickoff and livestream intro."
    },
    {
        id: "call_to_worship",
        title: "Call to Worship & Sound Testing",
        minister: "Technical & Worship Teams",
        venue: "Main stage",
        venueDisplay: "Main Stage",
        duration: "15 mins",
        durationMinutes: 15,
        startTime: "09:30",
        endTime: "09:45",
        timeDisplay: "9:30am - 9:45am",
        category: "worship",
        description: "Sanctuary sound alignment and preliminary call to devotion."
    },
    {
        id: "praise_worship",
        title: "Praise & Worship",
        minister: "LTC Mass Choir",
        venue: "Main stage",
        venueDisplay: "Main Stage",
        duration: "20 mins",
        durationMinutes: 20,
        startTime: "09:45",
        endTime: "10:05",
        timeDisplay: "9:45am - 10:05am",
        category: "worship",
        description: "High-energy mass choir praise session ushering in God's presence."
    },
    {
        id: "opening_prayer",
        title: "Opening Prayer",
        minister: "Session Leader",
        venue: "Main stage",
        venueDisplay: "Main Stage",
        duration: "5 mins",
        durationMinutes: 5,
        startTime: "10:05",
        endTime: "10:10",
        timeDisplay: "10:05am - 10:10am",
        category: "general",
        description: "Consecration and official dedication of the conference."
    },
    {
        id: "opening_monologue",
        title: "Opening Monologue",
        minister: "Conference Anchors",
        venue: "Main stage",
        venueDisplay: "Main Stage",
        duration: "5 mins",
        durationMinutes: 5,
        startTime: "10:10",
        endTime: "10:15",
        timeDisplay: "10:10am - 10:15am",
        category: "general",
        description: "Setting the atmosphere and unveiling the T.I.M.E '26 vision."
    },
    {
        id: "talent_display",
        title: "Talent Display",
        minister: "Jesus Choreography Dancers",
        venue: "Main stage",
        venueDisplay: "Main Stage",
        duration: "15 mins",
        durationMinutes: 15,
        startTime: "10:15",
        endTime: "10:30",
        timeDisplay: "10:15am - 10:30am",
        category: "activity",
        description: "Electrifying creative choreographic performance."
    },
    {
        id: "welcome_address",
        title: "Welcome Address",
        minister: "Continent 3 Coordinator",
        venue: "Main stage",
        venueDisplay: "Main Stage",
        duration: "10 mins",
        durationMinutes: 10,
        startTime: "10:30",
        endTime: "10:40",
        timeDisplay: "10:30am - 10:40am",
        category: "general",
        description: "Official welcome address to delegates from all regions."
    },
    {
        id: "worship_minister",
        title: "Worship Minister",
        minister: "Minister Ayoladun",
        venue: "Main stage",
        venueDisplay: "Main Stage",
        duration: "30 mins",
        durationMinutes: 30,
        startTime: "10:40",
        endTime: "11:10",
        timeDisplay: "10:40am - 11:10am",
        category: "worship",
        description: "Deep, intimate worship leading delegates into spiritual elevation."
    },
    {
        id: "word_minister",
        title: "Word Minister",
        minister: "Pastor Femi Oyewunmi",
        venue: "Main stage",
        venueDisplay: "Main Stage",
        duration: "40 mins",
        durationMinutes: 40,
        startTime: "11:10",
        endTime: "11:50",
        timeDisplay: "11:10am - 11:50am",
        category: "keynote",
        description: "Transformative keynote charge on 'The Incredible Me Evolving'."
    },
    {
        id: "anchors_interlude",
        title: "Anchors Interlude: T.I.M.E. Declarations",
        minister: "Anchors & All Delegates",
        venue: "Main stage",
        venueDisplay: "Main Stage",
        duration: "10 mins",
        durationMinutes: 10,
        startTime: "11:50",
        endTime: "12:00",
        timeDisplay: "11:50am - 12:00pm",
        isInteractive: true,
        interactiveType: "confession",
        category: "activity",
        description: "Arena-wide recitation of the T.I.M.E. Confession scriptures."
    },
    {
        id: "spoken_words",
        title: "Spoken Words",
        minister: "Creative Spoken Word Artists",
        venue: "Main stage",
        venueDisplay: "Main Stage",
        duration: "10 mins",
        durationMinutes: 10,
        startTime: "12:00",
        endTime: "12:10",
        timeDisplay: "12:00pm - 12:10pm",
        category: "activity",
        description: "Poetic, inspiring spoken word rendition on purposeful living."
    },
    {
        id: "fathers_blessing",
        title: "Father's Blessing",
        minister: "Pastor Odesola",
        venue: "Main stage",
        venueDisplay: "Main Stage",
        duration: "15 mins",
        durationMinutes: 15,
        startTime: "12:10",
        endTime: "12:25",
        timeDisplay: "12:10pm - 12:25pm",
        category: "general",
        description: "Paternal apostolic blessing and prophetic declarations upon the youths."
    },
    {
        id: "choir_ministration",
        title: "Choir Ministration",
        minister: "LTC Mass Choir",
        venue: "Main stage",
        venueDisplay: "Main Stage",
        duration: "20 mins",
        durationMinutes: 20,
        startTime: "12:25",
        endTime: "12:45",
        timeDisplay: "12:25pm - 12:45pm",
        category: "worship",
        description: "Choral masterpiece ministration by the mass choir."
    },
    {
        id: "tgs_keynote",
        title: "The Governor's Session (TGS)",
        minister: "Pastor Foluke Irukera",
        venue: "Main stage",
        venueDisplay: "Main Stage",
        duration: "30 mins",
        durationMinutes: 30,
        startTime: "12:45",
        endTime: "13:15",
        timeDisplay: "12:45pm - 1:15pm",
        category: "keynote",
        description: "Keynote leadership & nation-building session."
    },
    {
        id: "tgs_qa",
        title: "TGS: Live Q&A Session",
        minister: "Pastor Foluke Irukera",
        venue: "Main stage",
        venueDisplay: "Main Stage",
        duration: "30 mins",
        durationMinutes: 30,
        startTime: "13:15",
        endTime: "13:45",
        timeDisplay: "1:15pm - 1:45pm",
        isInteractive: true,
        interactiveType: "qa",
        category: "keynote",
        description: "Interactive questions & answers session with Pastor Foluke Irukera."
    },
    {
        id: "vote_of_thanks",
        title: "Vote of Thanks",
        minister: "LTC Chairman / DTCE Representative",
        venue: "Main stage",
        venueDisplay: "Main Stage",
        duration: "5 mins",
        durationMinutes: 5,
        startTime: "13:45",
        endTime: "13:50",
        timeDisplay: "1:45pm - 1:50pm",
        category: "general",
        description: "Appreciations and acknowledgments of guests, leaders, and teams."
    },
    {
        id: "praise_party",
        title: "Praise Party & Offering",
        minister: "Tobi Akuraku / Daniel G Praise",
        venue: "Main stage",
        venueDisplay: "Main Stage",
        duration: "40 mins",
        durationMinutes: 40,
        startTime: "13:50",
        endTime: "14:30",
        timeDisplay: "1:50pm - 2:30pm",
        category: "worship",
        description: "Celebratory high praise explosion and thanksgiving offering."
    },
    {
        id: "closing_studio",
        title: "Closing Studio Session",
        minister: "Studio Anchors",
        venue: "Indoor Studio",
        venueDisplay: "Indoor Studio",
        duration: "20 mins",
        durationMinutes: 20,
        startTime: "14:30",
        endTime: "14:50",
        timeDisplay: "2:30pm - 2:50pm",
        category: "studio",
        description: "Post-event broadcast wrap-up, delegate reactions, and conference sign-off."
    }
];

/**
 * Calculates display time with an optional delay offset in minutes.
 */
export function formatAdjustedTime(baseTime24: string, delayMinutes: number): string {
    const [hoursStr, minsStr] = baseTime24.split(':');
    let totalMinutes = parseInt(hoursStr, 10) * 60 + parseInt(minsStr, 10) + delayMinutes;
    
    // Normalize within 24h
    totalMinutes = ((totalMinutes % 1440) + 1440) % 1440;
    
    const adjHours = Math.floor(totalMinutes / 60);
    const adjMins = totalMinutes % 60;
    
    const period = adjHours >= 12 ? 'pm' : 'am';
    const displayHours = adjHours % 12 === 0 ? 12 : adjHours % 12;
    const displayMins = adjMins.toString().padStart(2, '0');
    
    return `${displayHours}:${displayMins}${period}`;
}

export function getAdjustedSessionTimeRange(session: ProgramSession, delayMinutes: number): string {
    if (delayMinutes === 0) {
        return session.timeDisplay;
    }
    const startAdj = formatAdjustedTime(session.startTime, delayMinutes);
    const endAdj = formatAdjustedTime(session.endTime, delayMinutes);
    return `${startAdj} - ${endAdj}`;
}
