import { z } from 'zod';
/** Emitted-property subset of WorkAdventure 96d43a841766b22418c061744e7ed2aafd9870d3,
 * libs/map-editor/src/types.ts. Names/defaults follow that pin; extend deliberately
 * when later tasks emit additional native properties. Does not grant server authority.
 */
const base=z.object({id:z.string(),buttonLabel:z.string().optional(),hideButtonLabel:z.boolean().optional(),resourceUrl:z.string().optional(),serverData:z.unknown().optional()});
const meetingConfig=z.object({startWithAudioMuted:z.boolean(),startWithVideoMuted:z.boolean(),disableChat:z.boolean().optional().default(false),raiseHandEnabled:z.boolean().optional().default(true)}).optional();
export const nativeAreaPropertySchema=z.discriminatedUnion('type',[
 base.extend({type:z.literal('silent')}),
 base.extend({type:z.literal('speakerMegaphone'),name:z.string(),chatEnabled:z.boolean().default(false),seeAttendees:z.boolean().default(false)}),
 base.extend({type:z.literal('listenerMegaphone'),speakerZoneName:z.string(),chatEnabled:z.boolean().default(false),allowTalking:z.boolean().optional().default(false),raiseHandEnabled:z.boolean().optional().default(true),waitingLink:z.string().optional()}),
 base.extend({type:z.literal('restrictedRightsPropertyData'),writeTags:z.array(z.string()).default([]),readTags:z.array(z.string()).default([])}),
 base.extend({type:z.literal('livekitRoomProperty'),roomName:z.string(),triggerMessage:z.string().optional(),livekitRoomConfig:meetingConfig,livekitRoomAdminTag:z.string().optional()}),
]);
export const emittedWamSchema=z.object({
 version:z.literal('2.1.0'),mapUrl:z.string(),entities:z.record(z.unknown()),
 areas:z.array(z.object({id:z.string(),name:z.string(),visible:z.boolean(),x:z.number(),y:z.number(),width:z.number(),height:z.number(),properties:z.array(nativeAreaPropertySchema)})),
 entityCollections:z.array(z.object({url:z.string(),type:z.enum(['file','marketplace'])})),lastCommandId:z.string().optional(),metadata:z.record(z.unknown()).optional(),settings:z.record(z.unknown()).optional(),vendor:z.unknown().optional(),
});
