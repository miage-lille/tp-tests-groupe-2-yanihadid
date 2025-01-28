import supertest from 'supertest';
import { TestServerFixture } from './tests/fixtures';
import { WebinarNotFoundException } from './webinars/exceptions/webinar-not-found';

describe('Webinar Routes E2E', () => {
  let fixture: TestServerFixture;

  // Initialize the test server and database before all tests
  beforeAll(async () => {
    fixture = new TestServerFixture();
    await fixture.init();
  });

  // Reset database state before each test
  beforeEach(async () => {
    await fixture.reset();
  });

  // Stop the server and clean up after all tests
  afterAll(async () => {
    await fixture.stop();
  });

  // Scenario: Happy Path - Successful seat update
  describe('Scenario: Happy Path', () => {
    it('should update webinar seats successfully', async () => {
      // ARRANGE: Create a webinar with initial seats
      const prisma = fixture.getPrismaClient();
      const server = fixture.getServer();

      const webinar = await prisma.webinar.create({
        data: {
          id: 'test-webinar',
          title: 'Webinar Test',
          seats: 10,
          startDate: new Date(),
          endDate: new Date(),
          organizerId: 'test-user',
        },
      });

      // ACT: Send a request to update the seats
      const response = await supertest(server)
        .post(`/webinars/${webinar.id}/seats`)
        .send({ seats: '30' })
        .expect(200);

      // ASSERT: Verify the response and the updated database state
      expect(response.body).toEqual({ message: 'Seats updated' });

      const updatedWebinar = await prisma.webinar.findUnique({
        where: { id: webinar.id },
      });
      expect(updatedWebinar?.seats).toBe(30);
    });
  });

  // Scenario: Webinar does not exist
  describe('Scenario: Non-existent Webinar', () => {
    it('should return 404 and an error message', async () => {
      // ARRANGE: Set up a server instance
      const server = fixture.getServer();

      // ACT: Send a request for a non-existent webinar ID
      const response = await supertest(server)
        .post(`/webinars/unknownId/seats`)
        .send({ seats: '200' })
        .expect(404);

      // ASSERT: Verify the error message and that no data is modified
      expect(response.body).toEqual({
        error: 'Webinar not found',
      });
    });
  });

  // Scenario: Unauthorized user trying to update webinar
  describe('Scenario: Unauthorized Access', () => {
    it('should return 401 and an error message when trying to update a webinar of another owner', async () => {
      // ARRANGE: Create a webinar owned by a different organizer
      const prisma = fixture.getPrismaClient();
      const server = fixture.getServer();

      const webinar = await prisma.webinar.create({
        data: {
          id: 'webinar-id2',
          organizerId: 'organizer-id2',
          title: 'Webinar2',
          startDate: new Date('2022-01-01T00:00:00Z'),
          endDate: new Date('2022-01-01T01:00:00Z'),
          seats: 100,
        },
      });

      // ACT: Attempt to update the seats as an unauthorized user
      const response = await supertest(server)
        .post(`/webinars/${webinar.id}/seats`)
        .send({ seats: '200' })
        .expect(401);

      // ASSERT: Verify the error message and that no data is modified
      expect(response.body).toEqual({
        error: 'User is not allowed to update this webinar',
      });

      const initialWebinar = await prisma.webinar.findUnique({
        where: { id: webinar.id },
      });
      expect(initialWebinar?.seats).toBe(100);
    });
  });
});
