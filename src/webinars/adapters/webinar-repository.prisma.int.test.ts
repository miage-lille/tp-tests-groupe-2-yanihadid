import { PrismaClient } from '@prisma/client';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { exec } from 'child_process';
import { PrismaWebinarRepository } from 'src/webinars/adapters/webinar-repository.prisma';
import { Webinar } from 'src/webinars/entities/webinar.entity';
import { promisify } from 'util';

const asyncExec = promisify(exec);

describe('PrismaWebinarRepository', () => {
  let container: StartedPostgreSqlContainer;
  let prismaClient: PrismaClient;
  let repository: PrismaWebinarRepository;

  // Initialize PostgreSQL container and Prisma client
  beforeAll(async () => {
    container = await new PostgreSqlContainer()
      .withDatabase('test_db')
      .withUsername('user_test')
      .withPassword('password_test')
      .withExposedPorts(5432)
      .start();

    const dbUrl = container.getConnectionUri();
    prismaClient = new PrismaClient({
      datasources: {
        db: { url: dbUrl },
      },
    });

    // Apply database migrations
    await asyncExec(`DATABASE_URL=${dbUrl} npx prisma migrate deploy`);
    return prismaClient.$connect();
  });

  // Reset database state before each test
  beforeEach(async () => {
    repository = new PrismaWebinarRepository(prismaClient);
    await prismaClient.webinar.deleteMany(); // Delete all records
    await prismaClient.$executeRawUnsafe('DELETE FROM "Webinar" CASCADE'); // For safety
  });

  // Cleanup after all tests
  afterAll(async () => {
    await container.stop({ timeout: 1000 });
    return prismaClient.$disconnect();
  });

  // Scenario: Creating a webinar
  describe('Scenario: repository.create', () => {
    it('should create a webinar successfully', async () => {
      // ARRANGE: Create a new webinar instance
      const webinar = new Webinar({
        id: 'webinar-id',
        organizerId: 'organizer-id',
        title: 'Webinar title',
        startDate: new Date('2022-01-01T00:00:00Z'),
        endDate: new Date('2022-01-01T01:00:00Z'),
        seats: 100,
      });

      // ACT: Save the webinar to the database
      await repository.create(webinar);

      // ASSERT: Verify the webinar was saved correctly
      const maybeWebinar = await prismaClient.webinar.findUnique({
        where: { id: 'webinar-id' },
      });
      expect(maybeWebinar).toEqual({
        id: 'webinar-id',
        organizerId: 'organizer-id',
        title: 'Webinar title',
        startDate: new Date('2022-01-01T00:00:00Z'),
        endDate: new Date('2022-01-01T01:00:00Z'),
        seats: 100,
      });
    });
  });

  // Scenario: Finding a webinar by ID
  describe('Scenario: repository.findById', () => {
    it('should find a webinar by ID', async () => {
      // ARRANGE: Create and save a webinar
      const webinar = new Webinar({
        id: 'webinar-id',
        organizerId: 'organizer-id',
        title: 'Webinar title',
        startDate: new Date('2022-01-01T00:00:00Z'),
        endDate: new Date('2022-01-01T01:00:00Z'),
        seats: 100,
      });
      await repository.create(webinar);

      // ACT: Find the webinar by ID
      const foundWebinar = await repository.findById('webinar-id');

      // ASSERT: Verify the webinar was found
      expect(foundWebinar).toBeDefined();
      expect(foundWebinar?.props).toEqual({
        id: 'webinar-id',
        organizerId: 'organizer-id',
        title: 'Webinar title',
        startDate: new Date('2022-01-01T00:00:00Z'),
        endDate: new Date('2022-01-01T01:00:00Z'),
        seats: 100,
      });
    });

    it('should return null if webinar is not found', async () => {
      // ACT: Attempt to find a non-existent webinar
      const foundWebinar = await repository.findById('non-existent-id');

      // ASSERT: Verify null is returned
      expect(foundWebinar).toBeNull();
    });
  });

  // Scenario: Updating a webinar
  describe('Scenario: repository.update', () => {
    it('should update a webinar successfully', async () => {
      // ARRANGE: Create and save a webinar
      const webinar = new Webinar({
        id: 'webinar-id',
        organizerId: 'organizer-id',
        title: 'Webinar title',
        startDate: new Date('2022-01-01T00:00:00Z'),
        endDate: new Date('2022-01-01T01:00:00Z'),
        seats: 100,
      });
      await repository.create(webinar);

      // Update fields
      webinar.update({
        title: 'Updated Webinar Title',
        seats: 200,
      });

      // ACT: Update the webinar in the database
      await repository.update(webinar);

      // ASSERT: Verify the changes were applied
      const updatedWebinar = await prismaClient.webinar.findUnique({
        where: { id: 'webinar-id' },
      });
      expect(updatedWebinar).toEqual({
        id: 'webinar-id',
        organizerId: 'organizer-id',
        title: 'Updated Webinar Title',
        startDate: new Date('2022-01-01T00:00:00Z'),
        endDate: new Date('2022-01-01T01:00:00Z'),
        seats: 200,
      });
    });

    it('should throw an error if webinar does not exist', async () => {
      // ARRANGE: Create a webinar instance that does not exist in the database
      const webinar = new Webinar({
        id: 'non-existent-id',
        organizerId: 'organizer-id',
        title: 'Non-Existent Webinar',
        startDate: new Date('2022-01-01T00:00:00Z'),
        endDate: new Date('2022-01-01T01:00:00Z'),
        seats: 100,
      });

      // ACT & ASSERT: Verify that updating a non-existent webinar throws an error
      await expect(repository.update(webinar)).rejects.toThrowError();
    });
  });
});
