import { testUser } from "src/users/tests/user-seeds";
import { InMemoryWebinarRepository } from "../adapters/webinar-repository.in-memory";
import { Webinar } from "../entities/webinar.entity";
import { ChangeSeats } from "./change-seats";
import { WebinarNotFoundException } from "../exceptions/webinar-not-found";
import { WebinarNotOrganizerException } from "../exceptions/webinar-not-organizer";
import { WebinarReduceSeatsException } from "../exceptions/webinar-reduce-seats";
import { WebinarTooManySeatsException } from "../exceptions/webinar-too-many-seats";

// Fonction utilitaire pour créer un webinaire
const createWebinar = () =>
  new Webinar({
    id: "webinar-id",
    organizerId: testUser.alice.props.id,
    title: "Webinar title",
    startDate: new Date("2024-01-01T00:00:00Z"),
    endDate: new Date("2024-01-01T01:00:00Z"),
    seats: 100,
  });

// Fixtures pour rendre les tests plus parlants
function expectWebinarToRemainUnchanged(webinarRepository: InMemoryWebinarRepository) {
  const webinar = webinarRepository.findByIdSync("webinar-id");
  expect(webinar?.props.seats).toEqual(100);
}

async function thenUpdatedWebinarSeatsShouldBe(
  webinarRepository: InMemoryWebinarRepository,
  expectedSeats: number
) {
  const updatedWebinar = await webinarRepository.findById("webinar-id");
  expect(updatedWebinar?.props.seats).toEqual(expectedSeats);
}

async function whenUserChangeSeatsWith(useCase: ChangeSeats, payload: any) {
  await useCase.execute(payload);
}

// Tests principaux
describe("Change seats use case", () => {
  let webinarRepository: InMemoryWebinarRepository;
  let useCase: ChangeSeats;

  beforeEach(() => {
    webinarRepository = new InMemoryWebinarRepository([createWebinar()]);
    useCase = new ChangeSeats(webinarRepository);
  });

  describe("Success scenarios", () => {
    it("should change the number of seats for a webinar", async () => {
      const payload = { user: testUser.alice, webinarId: "webinar-id", seats: 200 };

      await whenUserChangeSeatsWith(useCase, payload);

      await thenUpdatedWebinarSeatsShouldBe(webinarRepository, 200);
    });
  });

  describe("Failure scenarios", () => {
    it("should fail when the webinar does not exist", async () => {
      webinarRepository = new InMemoryWebinarRepository([]); // Empty repository
      useCase = new ChangeSeats(webinarRepository);

      const payload = { user: testUser.alice, webinarId: "non-existent-webinar-id", seats: 200 };

      await expect(useCase.execute(payload)).rejects.toThrow(WebinarNotFoundException);
    });

    it("should fail when user is not the organizer", async () => {
      const payload = { user: testUser.bob, webinarId: "webinar-id", seats: 200 };

      await expect(useCase.execute(payload)).rejects.toThrow(WebinarNotOrganizerException);

      expectWebinarToRemainUnchanged(webinarRepository);
    });

    it("should fail when reducing seats to an inferior number", async () => {
      const payload = { user: testUser.alice, webinarId: "webinar-id", seats: 50 };

      await expect(useCase.execute(payload)).rejects.toThrow(WebinarReduceSeatsException);

      expectWebinarToRemainUnchanged(webinarRepository);
    });

    it("should fail when changing seats to a number greater than 1000", async () => {
      const payload = { user: testUser.alice, webinarId: "webinar-id", seats: 1200 };

      await expect(useCase.execute(payload)).rejects.toThrow(WebinarTooManySeatsException);

      expectWebinarToRemainUnchanged(webinarRepository);
    });

    it("should allow changing seats to exactly 1000", async () => {
      const payload = { user: testUser.alice, webinarId: "webinar-id", seats: 1000 };

      await whenUserChangeSeatsWith(useCase, payload);

      await thenUpdatedWebinarSeatsShouldBe(webinarRepository, 1000);
    });
  });
});
