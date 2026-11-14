// The faces a flexible card offers, by id, in menu order.
//
// Module: returns { choices, idOf }: choices are { id, label, face } for
// FaceChoiceHandler; idOf( face ) is the id of a face object, or null for a
// face no flexible card offers.
define([
    'faces/PlayerBackFace',
    'faces/EncounterBackFace',
    'faces/EnemyFace',
    'faces/ScenarioRulesFace',
    'faces/StoryFace',
    'faces/TokenRulesFace',
    'faces/TreacheryFace',
    'faces/AssetFace',
    'faces/EventFace',
    'faces/SkillFace',
    'faces/CustomizableFace',
    'faces/CustomizableBackFace',
    'faces/LocationFace',
    'faces/LocationBackFace',
    'faces/KeyFace',
    'faces/InvestigatorFace',
    'faces/InvestigatorBackFace',
    'faces/ActFace',
    'faces/ActBackFace',
    'faces/AgendaFace',
    'faces/AgendaBackFace',
    'faces/AgendaFrontPortraitFace',
    'faces/AgendaPortraitFace',
    'faces/PortraitFace',
    'faces/TreacheryLocationFace',
    'faces/EnemyLocationFace',
], function (
    PlayerBackFace,
    EncounterBackFace,
    EnemyFace,
    ScenarioRulesFace,
    StoryFace,
    TokenRulesFace,
    TreacheryFace,
    AssetFace,
    EventFace,
    SkillFace,
    CustomizableFace,
    CustomizableBackFace,
    LocationFace,
    LocationBackFace,
    KeyFace,
    InvestigatorFace,
    InvestigatorBackFace,
    ActFace,
    ActBackFace,
    AgendaFace,
    AgendaBackFace,
    AgendaFrontPortraitFace,
    AgendaPortraitFace,
    PortraitFace,
    TreacheryLocationFace,
    EnemyLocationFace
) {
    // face ids, in menu order, and their faces
    const Faces = {
        playerBack: PlayerBackFace,
        encounterBack: EncounterBackFace,
        enemy: EnemyFace,
        scenarioRules: ScenarioRulesFace,
        story: StoryFace,
        tokenRules: TokenRulesFace,
        treachery: TreacheryFace,
        asset: AssetFace,
        event: EventFace,
        skill: SkillFace,
        customizable: CustomizableFace,
        customizableBack: CustomizableBackFace,
        location: LocationFace,
        locationBack: LocationBackFace,
        key: KeyFace,
        investigator: InvestigatorFace,
        investigatorBack: InvestigatorBackFace,
        act: ActFace,
        actBack: ActBackFace,
        agenda: AgendaFace,
        agendaBack: AgendaBackFace,
        agendaFrontPortrait: AgendaFrontPortraitFace,
        agendaPortrait: AgendaPortraitFace,
        portrait: PortraitFace,
        treacheryLocation: TreacheryLocationFace,
        enemyLocation: EnemyLocationFace,
    };

    const Choices = Object.keys(Faces).map(function (id) {
        return { id: id, label: 'AHLCG-Face-' + id, face: Faces[id] };
    });

    function idOf(face) {
        for (let id in Faces) {
            if (face.constructor === Faces[id]) return id;
        }
        return null;
    }

    return { choices: Choices, idOf: idOf };
});
