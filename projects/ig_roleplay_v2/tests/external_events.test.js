const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildExternalEventPacket,
  buildExternalEventRepairFacts
} = require('../src/agent/external_events');

function makePacket() {
  return buildExternalEventPacket({
    manualExternalEvents: {
      version: '3.0.0-alpha.1',
      sourceFile: '/tmp/manual_external_events.json',
      events: [
        {
          eventId: 'bookstore_weekend_stationery_display',
          title: 'Temporary stationery display',
          status: 'scheduled',
          timeWindow: {
            start: '2026-03-20T00:00:00+08:00',
            end: '2026-03-31T23:59:59+08:00',
            scheduleModes: ['weekend'],
            routineWindows: ['afternoon_pause'],
            currentContexts: ['weekend_pause_window']
          },
          scope: {
            city: 'Shanghai',
            placeIds: ['bookstore_aisle']
          },
          factStatements: [
            'A temporary stationery and notebook display is set near the quiet bookstore aisle entrance.'
          ],
          placeStateChanges: [
            {
              placeId: 'bookstore_aisle',
              stateFacts: [
                'The aisle now has a temporary display edge with extra notebook stacks.'
              ],
              addedPhysicalTraits: ['temporary display edge']
            }
          ],
          objectAvailabilityChanges: [
            {
              objectId: 'binder_clip_tray',
              label: 'binder clip tray',
              stateFacts: [
                'A small tray of binder clips is plausibly visible near the temporary display.'
              ],
              physicalTraits: ['small metal clips']
            }
          ],
          ambientShifts: ['Weekend browsing traffic is slightly denser around the entrance shelves.'],
          hardConstraints: ['Do not force the display into the protagonist moment unless she really notices it.']
        }
      ]
    },
    dayContext: {
      time: {
        timestamp: '2026-03-22T15:10:00+08:00',
        routineWindow: 'afternoon_pause'
      },
      date: {
        scheduleMode: 'weekend'
      },
      location: {
        city: 'Shanghai',
        currentContext: 'weekend_pause_window'
      }
    },
    scenario: {}
  });
}

test('buildExternalEventPacket activates matching manual world-state events without turning them into topic assignments', () => {
  const packet = makePacket();

  assert.deepEqual(packet.activeEventIds, ['bookstore_weekend_stationery_display']);
  assert.match(packet.worldStateNotes[0], /temporary stationery and notebook display/i);
  assert.match(packet.guardrails[0], /must not assign a post topic/i);
  assert.match(packet.hardConstraints[0], /Do not force the display/i);
});

test('buildExternalEventRepairFacts turns active events into reality-bound facts', () => {
  const packet = makePacket();
  const repairFacts = buildExternalEventRepairFacts({
    externalEventPacket: packet,
    placeLookup: { bookstore_aisle: 'quiet bookstore aisle' }
  });

  assert.equal(repairFacts.length, 3);
  assert.match(repairFacts[0].statement, /temporary stationery and notebook display/i);
  assert.match(repairFacts[1].statement, /quiet bookstore aisle/i);
  assert.match(repairFacts[2].statement, /binder clip tray/i);
});
