// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/**
 * @title MediTrust
 * @notice Patient-safety platform for medicines in Ethiopia.
 * @dev Implements FR-RR-06, FR-RR-07, FR-RR-09, FR-RR-11, Section 2.3 of SRS Addendum v1.1.
 * Hard rule 1: No personal data on-chain, ever.
 * Hard rule 2: Recall works on-chain even if notification worker is down (NFR-21).
 */
contract MediTrust is AccessControl {
    bytes32 public constant REGULATOR_ROLE = keccak256("REGULATOR_ROLE");
    bytes32 public constant MANUFACTURER_ROLE = keccak256("MANUFACTURER_ROLE");
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");
    bytes32 public constant PHARMACY_ROLE = keccak256("PHARMACY_ROLE");

    /// @notice FR-RR-11: Recall severity classification
    enum RecallSeverity {
        None,
        ClassI,   // Dangerous or defective products with critical health risk (e.g. 24h default)
        ClassII,  // Products that might cause temporary/medically reversible adverse consequences (default 48h)
        ClassIII  // Products not likely to cause adverse health consequences (e.g. 72h default)
    }

    /// @notice FR-VA-02: Pack verification status enum
    enum PackStatus {
        Unknown,        // 0
        Genuine,        // 1
        Sold,           // 2
        Recalled,       // 3
        Expired,        // 4
        CloneSuspected  // 5
    }

    struct VerifyPackResult {
        PackStatus status;
        string gtin;
        string batchNumber;
        uint64 expiryDate;
        bool isRecalled;
        bool isSold;
        bool isCloneSuspected;
    }

    /// @notice Batch record
    struct Batch {
        string gtin;
        string batchNumber;
        uint64 expiryDate;
        bytes32 merkleRoot;
        uint32 initialQuantity;
        bool isRecalled;
        RecallSeverity severity;
    }

    /// @notice Section 2.3: Struct recording recall acknowledgement
    struct RecallAck {
        uint32 quantityQuarantined;
        uint64 timestamp;
        string evidenceCid;
    }

    uint256 public nextBatchId = 1;

    // batchId => Batch
    mapping(uint256 => Batch) public batches;

    // batchId => holder => recorded stock holding
    mapping(uint256 => mapping(address => uint32)) public holdings;

    // Section 2.3: mapping(uint256 batchId => mapping(address holder => RecallAck)) public recallAcks;
    mapping(uint256 => mapping(address => RecallAck)) public recallAcks;

    // Section 2.3: mapping(uint256 batchId => uint64) public recallDeadline;
    mapping(uint256 => uint64) public recallDeadline;

    // batchId => holder => isMarkedOverdue
    mapping(uint256 => mapping(address => bool)) public isOverdue;

    // batchId => serialHash => isSold
    mapping(uint256 => mapping(bytes32 => bool)) public isSold;

    // batchId => serialHash => isCloneSuspected
    mapping(uint256 => mapping(bytes32 => bool)) public isCloneSuspected;

    // Default recall deadline duration: 48 hours (in seconds)
    uint64 public constant DEFAULT_RECALL_DEADLINE_DURATION = 48 hours;

    // Events
    event BatchRegistered(
        uint256 indexed batchId,
        string gtin,
        string batchNumber,
        uint32 initialQuantity,
        uint64 expiryDate,
        bytes32 merkleRoot,
        address indexed manufacturer
    );

    event StockTransferred(
        uint256 indexed batchId,
        address indexed from,
        address indexed to,
        uint32 quantity
    );

    event BatchRecalled(
        uint256 indexed batchId,
        RecallSeverity severity,
        uint64 deadline,
        string reason
    );

    event RecallAcknowledged(
        uint256 indexed batchId,
        address indexed holder,
        uint32 qty,
        uint64 time
    );

    event RecallOverdue(
        uint256 indexed batchId,
        address indexed holder,
        uint64 time
    );

    event PackSold(
        uint256 indexed batchId,
        bytes32 indexed serialHash,
        address indexed pharmacy
    );

    event CloneAttemptDetected(
        uint256 indexed batchId,
        bytes32 indexed serialHash,
        address indexed pharmacy
    );

    // Custom Errors
    error NotApprovedHolder(address caller);
    error BatchDoesNotExist(uint256 batchId);
    error BatchNotRecalled(uint256 batchId);
    error BatchAlreadyRecalled(uint256 batchId);
    error NoHoldings(uint256 batchId, address holder);
    error ExceedsHoldings(uint32 requestedQty, uint32 recordedHoldings);
    error AcknowledgementMustIncrease(uint32 currentAcknowledged, uint32 requestedQty);
    error DeadlineNotPassed(uint64 currentTimestamp, uint64 deadline);
    error AlreadyAcknowledged(uint256 batchId, address holder);
    error AlreadyMarkedOverdue(uint256 batchId, address holder);
    error InvalidQuantity();
    error InsufficientStock(uint32 available, uint32 requested);

    constructor(address initialAdmin) {
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        _grantRole(REGULATOR_ROLE, initialAdmin);
    }

    modifier onlyRegulator() {
        if (!hasRole(REGULATOR_ROLE, msg.sender) && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            revert NotApprovedHolder(msg.sender);
        }
        _;
    }

    modifier onlyManufacturer() {
        if (!hasRole(MANUFACTURER_ROLE, msg.sender)) {
            revert NotApprovedHolder(msg.sender);
        }
        _;
    }

    /**
     * @notice Register a newly manufactured batch and initialize manufacturer holding
     */
    function registerBatch(
        string calldata gtin,
        string calldata batchNumber,
        uint64 expiryDate,
        bytes32 merkleRoot,
        uint32 initialQuantity
    ) external onlyManufacturer returns (uint256 batchId) {
        if (initialQuantity == 0) revert InvalidQuantity();
        batchId = nextBatchId++;
        batches[batchId] = Batch({
            gtin: gtin,
            batchNumber: batchNumber,
            expiryDate: expiryDate,
            merkleRoot: merkleRoot,
            initialQuantity: initialQuantity,
            isRecalled: false,
            severity: RecallSeverity.None
        });

        holdings[batchId][msg.sender] = initialQuantity;

        emit BatchRegistered(
            batchId,
            gtin,
            batchNumber,
            initialQuantity,
            expiryDate,
            merkleRoot,
            msg.sender
        );
    }

    /**
     * @notice Transfer physical custody / stock holding of a batch to another approved actor
     */
    function transferStock(
        uint256 batchId,
        address to,
        uint32 quantity
    ) external {
        if (batches[batchId].initialQuantity == 0) revert BatchDoesNotExist(batchId);
        if (quantity == 0) revert InvalidQuantity();
        uint32 currentHolding = holdings[batchId][msg.sender];
        if (currentHolding < quantity) revert InsufficientStock(currentHolding, quantity);

        holdings[batchId][msg.sender] = currentHolding - quantity;
        holdings[batchId][to] += quantity;

        emit StockTransferred(batchId, msg.sender, to, quantity);
    }

    /**
     * @notice Trigger a regulatory batch recall with configurable deadline and severity
     * @dev FR-RR-09, FR-RR-11: Configurable deadline (default 48h if 0 is passed)
     */
    function recallBatch(
        uint256 batchId,
        RecallSeverity severity,
        uint64 deadlineDurationSeconds,
        string calldata reason
    ) external onlyRegulator {
        if (batches[batchId].initialQuantity == 0) revert BatchDoesNotExist(batchId);
        if (batches[batchId].isRecalled) revert BatchAlreadyRecalled(batchId);

        batches[batchId].isRecalled = true;
        batches[batchId].severity = severity;

        uint64 duration = deadlineDurationSeconds > 0
            ? deadlineDurationSeconds
            : DEFAULT_RECALL_DEADLINE_DURATION;

        uint64 deadline = uint64(block.timestamp) + duration;
        recallDeadline[batchId] = deadline;

        emit BatchRecalled(batchId, severity, deadline, reason);
    }

    /**
     * @notice Acknowledge a recall and record quarantined quantity
     * @dev Implements FR-RR-06, FR-RR-07, Section 2.3
     * Enforces rules:
     * 1. Only an approved holder (Distributor or Pharmacy) with non-zero holdings of a recalled batch can acknowledge.
     * 2. Acknowledgement cannot exceed the holder's recorded holding.
     * 3. Acknowledgements cannot be edited, only increased by a later, larger entry.
     */
    function acknowledgeRecall(
        uint256 batchId,
        uint32 qty,
        string calldata evidenceCid
    ) external {
        // Rule 1: Role check - Distributor or Pharmacy only
        if (!hasRole(DISTRIBUTOR_ROLE, msg.sender) && !hasRole(PHARMACY_ROLE, msg.sender)) {
            revert NotApprovedHolder(msg.sender);
        }

        // Rule 1: Recalled batch check
        if (!batches[batchId].isRecalled) {
            revert BatchNotRecalled(batchId);
        }

        // Rule 1: Non-zero recorded holding
        uint32 currentHolding = holdings[batchId][msg.sender];
        if (currentHolding == 0) {
            revert NoHoldings(batchId, msg.sender);
        }

        if (qty == 0) {
            revert InvalidQuantity();
        }

        // Rule 2: Cannot exceed holder's recorded holding
        if (qty > currentHolding) {
            revert ExceedsHoldings(qty, currentHolding);
        }

        // Rule 3: Cannot be edited, only added to / increased by a later, larger entry
        uint32 prevAcknowledged = recallAcks[batchId][msg.sender].quantityQuarantined;
        if (prevAcknowledged > 0 && qty <= prevAcknowledged) {
            revert AcknowledgementMustIncrease(prevAcknowledged, qty);
        }

        // Record acknowledgement
        recallAcks[batchId][msg.sender] = RecallAck({
            quantityQuarantined: qty,
            timestamp: uint64(block.timestamp),
            evidenceCid: evidenceCid
        });

        emit RecallAcknowledged(batchId, msg.sender, qty, uint64(block.timestamp));
    }

    /**
     * @notice Mark a holder as overdue if they fail to acknowledge before the deadline
     * @dev Implements FR-RR-09, Section 2.3
     * Rule 4: Reverts if the holder already acknowledged or the deadline has not passed.
     * Callable by anyone after the deadline.
     */
    function markOverdue(uint256 batchId, address holder) external {
        if (!batches[batchId].isRecalled) {
            revert BatchNotRecalled(batchId);
        }

        // Holder must have recorded holdings of this batch
        if (holdings[batchId][holder] == 0) {
            revert NoHoldings(batchId, holder);
        }

        // Rule 4: Reverts if deadline has not passed
        uint64 deadline = recallDeadline[batchId];
        if (block.timestamp <= deadline) {
            revert DeadlineNotPassed(uint64(block.timestamp), deadline);
        }

        // Rule 4: Reverts if the holder already acknowledged
        if (recallAcks[batchId][holder].quantityQuarantined > 0) {
            revert AlreadyAcknowledged(batchId, holder);
        }

        // Cannot mark overdue multiple times
        if (isOverdue[batchId][holder]) {
            revert AlreadyMarkedOverdue(batchId, holder);
        }

        isOverdue[batchId][holder] = true;

        emit RecallOverdue(batchId, holder, uint64(block.timestamp));
    }

    /**
     * @notice Helper to read batch details
     */
    function getBatch(uint256 batchId) external view returns (Batch memory) {
        return batches[batchId];
    }

    /**
     * @notice Helper to check if a batch is recalled
     */
    function isBatchRecalled(uint256 batchId) external view returns (bool) {
        return batches[batchId].isRecalled;
    }

    /**
     * @notice Dispense a medicine pack at pharmacy counter; detects clone attempts if already sold
     */
    function dispensePack(uint256 batchId, bytes32 serialHash) external {
        if (!hasRole(PHARMACY_ROLE, msg.sender)) revert NotApprovedHolder(msg.sender);
        if (batches[batchId].initialQuantity == 0) revert BatchDoesNotExist(batchId);

        if (isSold[batchId][serialHash]) {
            isCloneSuspected[batchId][serialHash] = true;
            emit CloneAttemptDetected(batchId, serialHash, msg.sender);
            return;
        }

        isSold[batchId][serialHash] = true;
        emit PackSold(batchId, serialHash, msg.sender);
    }

    /**
     * @notice Public verification function (read-only, RPC only, no database)
     * @dev Implements FR-VA-02, Section 3.2
     */
    function verifyPack(
        uint256 batchId,
        bytes32 serialHash,
        bytes32[] calldata merkleProof
    ) external view returns (VerifyPackResult memory result) {
        Batch storage b = batches[batchId];
        if (b.initialQuantity == 0) {
            result.status = PackStatus.Unknown;
            return result;
        }

        // Verify Merkle proof against registered root if provided
        if (b.merkleRoot != bytes32(0) && merkleProof.length > 0) {
            bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(batchId, serialHash))));
            bool valid = MerkleProof.verify(merkleProof, b.merkleRoot, leaf) ||
                         MerkleProof.verify(merkleProof, b.merkleRoot, serialHash);
            if (!valid) {
                result.status = PackStatus.Unknown;
                return result;
            }
        }

        result.gtin = b.gtin;
        result.batchNumber = b.batchNumber;
        result.expiryDate = b.expiryDate;
        result.isRecalled = b.isRecalled;
        result.isSold = isSold[batchId][serialHash];
        result.isCloneSuspected = isCloneSuspected[batchId][serialHash];

        // Safety precedence determination
        if (result.isCloneSuspected) {
            result.status = PackStatus.CloneSuspected;
        } else if (b.isRecalled) {
            result.status = PackStatus.Recalled;
        } else if (block.timestamp > b.expiryDate) {
            result.status = PackStatus.Expired;
        } else if (result.isSold) {
            result.status = PackStatus.Sold;
        } else {
            result.status = PackStatus.Genuine;
        }
    }
}

