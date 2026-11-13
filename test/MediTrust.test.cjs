const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("MediTrust - Recall Acknowledgement & Overdue Tracking (SRS v1.1 Step 1)", function () {
  let mediTrust;
  let admin, regulator, manufacturer, distributor, pharmacy, otherPharmacy, publicCaller;
  let REGULATOR_ROLE, MANUFACTURER_ROLE, DISTRIBUTOR_ROLE, PHARMACY_ROLE;
  
  let batchId1;
  let batchIdNonRecalled;

  const GTIN = "07612345678900";
  const BATCH_NO = "ET-2026-MED01";
  const INITIAL_QTY = 1000;
  const EXPIRY = Math.floor(Date.now() / 1000) + 365 * 24 * 3600;
  const MERKLE_ROOT = ethers.keccak256(ethers.toUtf8Bytes("merkle-root-et-2026"));

  beforeEach(async function () {
    [admin, regulator, manufacturer, distributor, pharmacy, otherPharmacy, publicCaller] =
      await ethers.getSigners();

    const MediTrustFactory = await ethers.getContractFactory("MediTrust");
    mediTrust = await MediTrustFactory.deploy(admin.address);
    await mediTrust.waitForDeployment();

    REGULATOR_ROLE = await mediTrust.REGULATOR_ROLE();
    MANUFACTURER_ROLE = await mediTrust.MANUFACTURER_ROLE();
    DISTRIBUTOR_ROLE = await mediTrust.DISTRIBUTOR_ROLE();
    PHARMACY_ROLE = await mediTrust.PHARMACY_ROLE();

    // Grant roles
    await mediTrust.connect(admin).grantRole(REGULATOR_ROLE, regulator.address);
    await mediTrust.connect(admin).grantRole(MANUFACTURER_ROLE, manufacturer.address);
    await mediTrust.connect(admin).grantRole(DISTRIBUTOR_ROLE, distributor.address);
    await mediTrust.connect(admin).grantRole(PHARMACY_ROLE, pharmacy.address);
    await mediTrust.connect(admin).grantRole(PHARMACY_ROLE, otherPharmacy.address);

    // Manufacturer registers batch 1
    const tx1 = await mediTrust
      .connect(manufacturer)
      .registerBatch(GTIN, BATCH_NO, EXPIRY, MERKLE_ROOT, INITIAL_QTY);
    const receipt1 = await tx1.wait();
    batchId1 = 1n;

    // Distribute stock: Manufacturer -> Distributor (500), Distributor -> Pharmacy (200)
    await mediTrust.connect(manufacturer).transferStock(batchId1, distributor.address, 500);
    await mediTrust.connect(distributor).transferStock(batchId1, pharmacy.address, 200);

    // Manufacturer registers batch 2 (stays non-recalled)
    const tx2 = await mediTrust
      .connect(manufacturer)
      .registerBatch(GTIN, "ET-2026-MED02", EXPIRY, MERKLE_ROOT, 500);
    await tx2.wait();
    batchIdNonRecalled = 2n;
    await mediTrust.connect(manufacturer).transferStock(batchIdNonRecalled, pharmacy.address, 100);
  });

  describe("Role & Base Setup Validation", function () {
    it("assigns roles properly and initial holdings are correct", async function () {
      expect(await mediTrust.hasRole(REGULATOR_ROLE, regulator.address)).to.be.true;
      expect(await mediTrust.hasRole(DISTRIBUTOR_ROLE, distributor.address)).to.be.true;
      expect(await mediTrust.hasRole(PHARMACY_ROLE, pharmacy.address)).to.be.true;

      expect(await mediTrust.holdings(batchId1, pharmacy.address)).to.equal(200);
      expect(await mediTrust.holdings(batchId1, distributor.address)).to.equal(300);
      expect(await mediTrust.holdings(batchId1, otherPharmacy.address)).to.equal(0);
    });
  });

  describe("Recall Initiation (FR-RR-09, FR-RR-11)", function () {
    it("sets default 48h deadline when duration is 0, and emits BatchRecalled", async function () {
      const now = await time.latest();
      const expectedDeadline = now + 48 * 3600;

      await expect(
        mediTrust.connect(regulator).recallBatch(batchId1, 2, 0, "Suspicious packaging reported")
      )
        .to.emit(mediTrust, "BatchRecalled")
        .withArgs(batchId1, 2, (deadline) => {
          return Math.abs(Number(deadline) - expectedDeadline) <= 5;
        }, "Suspicious packaging reported");

      const deadline = await mediTrust.recallDeadline(batchId1);
      expect(Number(deadline)).to.be.closeTo(expectedDeadline, 5);
      expect(await mediTrust.isBatchRecalled(batchId1)).to.be.true;
    });

    it("allows custom deadline duration for high-priority recalls", async function () {
      const customDuration = 24 * 3600; // 24 hours for Class I
      const now = await time.latest();

      await mediTrust
        .connect(regulator)
        .recallBatch(batchId1, 1, customDuration, "Critical impurity detected");

      const deadline = await mediTrust.recallDeadline(batchId1);
      expect(Number(deadline)).to.be.closeTo(now + customDuration, 5);
    });
  });

  describe("Recall Acknowledgement (FR-RR-06, FR-RR-07, Section 2.3 Rules)", function () {
    beforeEach(async function () {
      // Recall batch 1 with default 48h deadline
      await mediTrust
        .connect(regulator)
        .recallBatch(batchId1, 2, 0, "Substandard active ingredient");
    });

    it("Rule 1 Failure: reverts when acknowledging a non-recalled batch", async function () {
      // batchIdNonRecalled has not been recalled
      await expect(
        mediTrust
          .connect(pharmacy)
          .acknowledgeRecall(batchIdNonRecalled, 50, "ipfs://evidence-cid-1")
      ).to.be.revertedWithCustomError(mediTrust, "BatchNotRecalled");
    });

    it("Rule 1 Failure: reverts when caller has no holdings of the recalled batch", async function () {
      // otherPharmacy has role but 0 holdings
      expect(await mediTrust.holdings(batchId1, otherPharmacy.address)).to.equal(0);

      await expect(
        mediTrust
          .connect(otherPharmacy)
          .acknowledgeRecall(batchId1, 10, "ipfs://evidence-cid-empty")
      ).to.be.revertedWithCustomError(mediTrust, "NoHoldings");
    });

    it("Rule 1 Failure: reverts when caller lacks DISTRIBUTOR or PHARMACY role", async function () {
      await expect(
        mediTrust
          .connect(publicCaller)
          .acknowledgeRecall(batchId1, 10, "ipfs://evidence-unauthorized")
      ).to.be.revertedWithCustomError(mediTrust, "NotApprovedHolder");
    });

    it("Rule 2 Failure: reverts when acknowledgement exceeds recorded holdings", async function () {
      const recorded = await mediTrust.holdings(batchId1, pharmacy.address);
      expect(recorded).to.equal(200);

      // Attempt to acknowledge 201 units
      await expect(
        mediTrust
          .connect(pharmacy)
          .acknowledgeRecall(batchId1, 201, "ipfs://evidence-too-many")
      )
        .to.be.revertedWithCustomError(mediTrust, "ExceedsHoldings")
        .withArgs(201, 200);
    });

    it("Rule 2 & FR-RR-07 Success: records acknowledgement and emits RecallAcknowledged", async function () {
      const ackQty = 150;
      const evidenceCid = "ipfs://bafybeiclkmedi7patientproof";

      await expect(
        mediTrust.connect(pharmacy).acknowledgeRecall(batchId1, ackQty, evidenceCid)
      )
        .to.emit(mediTrust, "RecallAcknowledged")
        .withArgs(batchId1, pharmacy.address, ackQty, (ts) => ts > 0);

      const ack = await mediTrust.recallAcks(batchId1, pharmacy.address);
      expect(ack.quantityQuarantined).to.equal(150);
      expect(ack.evidenceCid).to.equal(evidenceCid);
      expect(ack.timestamp).to.be.greaterThan(0);
    });

    it("Rule 3 Failure: reverts on double acknowledgement with same or lower quantity", async function () {
      await mediTrust
        .connect(pharmacy)
        .acknowledgeRecall(batchId1, 100, "ipfs://first-ack");

      // Double acknowledgement with exact same quantity
      await expect(
        mediTrust
          .connect(pharmacy)
          .acknowledgeRecall(batchId1, 100, "ipfs://second-ack-duplicate")
      )
        .to.be.revertedWithCustomError(mediTrust, "AcknowledgementMustIncrease")
        .withArgs(100, 100);

      // Attempt with lower quantity
      await expect(
        mediTrust
          .connect(pharmacy)
          .acknowledgeRecall(batchId1, 80, "ipfs://second-ack-lower")
      )
        .to.be.revertedWithCustomError(mediTrust, "AcknowledgementMustIncrease")
        .withArgs(100, 80);
    });

    it("Rule 3 Success: permits increasing an acknowledgement with later larger entry", async function () {
      await mediTrust
        .connect(pharmacy)
        .acknowledgeRecall(batchId1, 100, "ipfs://first-ack");

      // Now pharmacy finds remaining 80 units in back storeroom and quarantines total 180 units
      const secondCid = "ipfs://second-ack-increased";
      await expect(
        mediTrust.connect(pharmacy).acknowledgeRecall(batchId1, 180, secondCid)
      )
        .to.emit(mediTrust, "RecallAcknowledged")
        .withArgs(batchId1, pharmacy.address, 180, (ts) => ts > 0);

      const ack = await mediTrust.recallAcks(batchId1, pharmacy.address);
      expect(ack.quantityQuarantined).to.equal(180);
      expect(ack.evidenceCid).to.equal(secondCid);
    });
  });

  describe("Marking Overdue (FR-RR-09, Section 2.3 Rules)", function () {
    beforeEach(async function () {
      // Recall batch 1 with 48h deadline
      await mediTrust
        .connect(regulator)
        .recallBatch(batchId1, 2, 48 * 3600, "Suspect contamination");

      // Pharmacy acknowledges 150 units on time
      await mediTrust
        .connect(pharmacy)
        .acknowledgeRecall(batchId1, 150, "ipfs://pharmacy-ack-on-time");

      // Distributor has 300 units but does NOT acknowledge
    });

    it("Rule 4 Failure: reverts markOverdue before deadline has passed", async function () {
      // Distributor has not acknowledged, but deadline has not yet passed
      await expect(
        mediTrust.connect(publicCaller).markOverdue(batchId1, distributor.address)
      ).to.be.revertedWithCustomError(mediTrust, "DeadlineNotPassed");
    });

    it("Rule 4 Failure: reverts markOverdue after deadline if holder already acknowledged", async function () {
      // Fast forward past the 48-hour deadline
      await time.increase(48 * 3600 + 100);

      // Pharmacy already acknowledged on time
      await expect(
        mediTrust.connect(publicCaller).markOverdue(batchId1, pharmacy.address)
      )
        .to.be.revertedWithCustomError(mediTrust, "AlreadyAcknowledged")
        .withArgs(batchId1, pharmacy.address);
    });

    it("Rule 4 Failure: reverts markOverdue if holder has no holdings in the batch", async function () {
      await time.increase(48 * 3600 + 100);

      // otherPharmacy has 0 holdings
      await expect(
        mediTrust.connect(publicCaller).markOverdue(batchId1, otherPharmacy.address)
      )
        .to.be.revertedWithCustomError(mediTrust, "NoHoldings")
        .withArgs(batchId1, otherPharmacy.address);
    });

    it("Rule 4 & Event Emission Success: marks non-compliant holder overdue after deadline", async function () {
      // Fast forward past deadline
      await time.increase(48 * 3600 + 100);

      // Public caller calls markOverdue on non-compliant distributor
      await expect(
        mediTrust.connect(publicCaller).markOverdue(batchId1, distributor.address)
      )
        .to.emit(mediTrust, "RecallOverdue")
        .withArgs(batchId1, distributor.address, (ts) => ts > 0);

      expect(await mediTrust.isOverdue(batchId1, distributor.address)).to.be.true;

      // Second attempt reverts with AlreadyMarkedOverdue
      await expect(
        mediTrust.connect(publicCaller).markOverdue(batchId1, distributor.address)
      )
        .to.be.revertedWithCustomError(mediTrust, "AlreadyMarkedOverdue")
        .withArgs(batchId1, distributor.address);
    });
  });
});
