// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { v4 as generateUuid } from 'uuid';
import { sample } from 'lodash';
import type { ConversationType } from '../../state/ducks/conversations';
import { UUID } from '../../types/UUID';
import type { UUIDStringType } from '../../types/UUID';
import { getRandomColor } from './getRandomColor';

const FIRST_NAMES = [
  'James',
  'John',
  'Robert',
  'Michael',
  'William',
  'David',
  'Richard',
  'Joseph',
  'Thomas',
  'Charles',
  'Christopher',
  'Daniel',
  'Matthew',
  'Anthony',
  'Donald',
  'Mark',
  'Paul',
  'Steven',
  'Andrew',
  'Kenneth',
  'Joshua',
  'Kevin',
  'Brian',
  'George',
  'Edward',
  'Ronald',
  'Timothy',
  'Jason',
  'Jeffrey',
  'Ryan',
  'Jacob',
  'Gary',
  'Nicholas',
  'Eric',
  'Jonathan',
  'Stephen',
  'Larry',
  'Justin',
  'Scott',
  'Brandon',
  'Benjamin',
  'Samuel',
  'Frank',
  'Gregory',
  'Raymond',
  'Alexander',
  'Patrick',
  'Jack',
  'Dennis',
  'Jerry',
  'Tyler',
  'Aaron',
  'Jose',
  'Henry',
  'Adam',
  'Douglas',
  'Nathan',
  'Peter',
  'Zachary',
  'Kyle',
  'Walter',
  'Harold',
  'Jeremy',
  'Ethan',
  'Carl',
  'Keith',
  'Roger',
  'Gerald',
  'Christian',
  'Terry',
  'Sean',
  'Arthur',
  'Austin',
  'Noah',
  'Lawrence',
  'Jesse',
  'Joe',
  'Bryan',
  'Billy',
  'Jordan',
  'Albert',
  'Dylan',
  'Bruce',
  'Willie',
  'Gabriel',
  'Alan',
  'Juan',
  'Logan',
  'Wayne',
  'Ralph',
  'Roy',
  'Eugene',
  'Randy',
  'Vincent',
  'Russell',
  'Louis',
  'Philip',
  'Bobby',
  'Johnny',
  'Bradley',
  'Mary',
  'Patricia',
  'Jennifer',
  'Linda',
  'Elizabeth',
  'Barbara',
  'Susan',
  'Jessica',
  'Sarah',
  'Karen',
  'Nancy',
  'Lisa',
  'Margaret',
  'Betty',
  'Sandra',
  'Ashley',
  'Dorothy',
  'Kimberly',
  'Emily',
  'Donna',
  'Michelle',
  'Carol',
  'Amanda',
  'Melissa',
  'Deborah',
  'Stephanie',
  'Rebecca',
  'Laura',
  'Sharon',
  'Cynthia',
  'Kathleen',
  'Amy',
  'Shirley',
  'Angela',
  'Helen',
  'Anna',
  'Brenda',
  'Pamela',
  'Nicole',
  'Samantha',
  'Katherine',
  'Emma',
  'Ruth',
  'Christine',
  'Catherine',
  'Debra',
  'Rachel',
  'Carolyn',
  'Janet',
  'Virginia',
  'Maria',
  'Heather',
  'Diane',
  'Julie',
  'Joyce',
  'Victoria',
  'Kelly',
  'Christina',
  'Lauren',
  'Joan',
  'Evelyn',
  'Olivia',
  'Judith',
  'Megan',
  'Cheryl',
  'Martha',
  'Andrea',
  'Frances',
  'Hannah',
  'Jacqueline',
  'Ann',
  'Gloria',
  'Jean',
  'Kathryn',
  'Alice',
  'Teresa',
  'Sara',
  'Janice',
  'Doris',
  'Madison',
  'Julia',
  'Grace',
  'Judy',
  'Abigail',
  'Marie',
  'Denise',
  'Beverly',
  'Amber',
  'Theresa',
  'Marilyn',
  'Danielle',
  'Diana',
  'Brittany',
  'Natalie',
  'Sophia',
  'Rose',
  'Isabella',
  'Alexis',
  'Kayla',
  'Charlotte',
];

const LAST_NAMES = [
  'Smith',
  'Johnson',
  'Williams',
  'Brown',
  'Jones',
  'Garcia',
  'Miller',
  'Davis',
  'Rodriguez',
  'Martinez',
  'Hernandez',
  'Lopez',
  'Gonzales',
  'Wilson',
  'Anderson',
  'Thomas',
  'Taylor',
  'Moore',
  'Jackson',
  'Martin',
  'Lee',
  'Perez',
  'Thompson',
  'White',
  'Harris',
  'Sanchez',
  'Clark',
  'Ramirez',
  'Lewis',
  'Robinson',
  'Walker',
  'Young',
  'Allen',
  'King',
  'Wright',
  'Scott',
  'Torres',
  'Nguyen',
  'Hill',
  'Flores',
  'Green',
  'Adams',
  'Nelson',
  'Baker',
  'Hall',
  'Rivera',
  'Campbell',
  'Mitchell',
  'Carter',
  'Roberts',
  'Gomez',
  'Phillips',
  'Evans',
  'Turner',
  'Diaz',
  'Parker',
  'Cruz',
  'Edwards',
  'Collins',
  'Reyes',
  'Stewart',
  'Morris',
  'Morales',
  'Murphy',
  'Cook',
  'Rogers',
  'Gutierrez',
  'Ortiz',
  'Morgan',
  'Cooper',
  'Peterson',
  'Bailey',
  'Reed',
  'Kelly',
  'Howard',
  'Ramos',
  'Kim',
  'Cox',
  'Ward',
  'Richardson',
  'Watson',
  'Brooks',
  'Chavez',
  'Wood',
  'James',
  'Bennet',
  'Gray',
  'Mendoza',
  'Ruiz',
  'Hughes',
  'Price',
  'Alvarez',
  'Castillo',
  'Sanders',
  'Patel',
  'Myers',
  'Long',
  'Ross',
  'Foster',
  'Jimenez',
];

export const getFirstName = (): string => sample(FIRST_NAMES) || 'Test';
export const getLastName = (): string => sample(LAST_NAMES) || 'Test';

export const getAvatarPath = (): string =>
  sample([
    '/fixtures/kitten-1-64-64.jpg',
    '/fixtures/kitten-2-64-64.jpg',
    '/fixtures/kitten-3-64-64.jpg',
  ]) || '';

export function getDefaultConversation(
  overrideProps: Partial<ConversationType> = {}
): ConversationType {
  const firstName = getFirstName();
  const lastName = getLastName();

  return {
    acceptedMessageRequest: true,
    avatarPath: getAvatarPath(),
    badges: [],
    e164: '+1300555000',
    color: getRandomColor(),
    firstName,
    id: generateUuid(),
    isMe: false,
    lastUpdated: Date.now(),
    markedUnread: Boolean(overrideProps.markedUnread),
    sharedGroupNames: [],
    title: `${firstName} ${lastName}`,
    type: 'direct' as const,
    uuid: UUID.generate().toString(),
    ...overrideProps,
  };
}

export function getDefaultConversationWithUuid(
  overrideProps: Partial<ConversationType> = {},
  uuid: UUIDStringType = UUID.generate().toString()
): ConversationType & { uuid: UUIDStringType } {
  return {
    ...getDefaultConversation(overrideProps),
    uuid,
  };
}
