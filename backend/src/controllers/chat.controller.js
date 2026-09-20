const Message = require('../models/Message');
const Listing = require('../models/Listing');

// GET /api/chat/:listingId
async function getConversation(req, res) {
  try {
    const { listingId } = req.params;
    const userId = req.user._id;

    const listing = await Listing.findById(listingId).select('seller');
    if (!listing) return res.status(404).json({ error: 'Listing not found' });

    const messages = await Message.find({
      listing: listingId,
      $or: [{ sender: userId }, { receiver: userId }],
    })
      .sort({ createdAt: 1 })
      .populate('sender', 'fullName')
      .populate('receiver', 'fullName');

    // Hide messages this user deleted "for me" from their own view
    const visibleMessages = messages.filter(
      (m) => !m.deletedFor.some((id) => id.toString() === userId.toString())
    );

    // Resolve who the "other person" is, reliably, without depending on
    // message history existing yet:
    // - if I'm the seller, the other party is whoever I've been messaging
    // - if I'm not the seller, the other party is the seller
    let otherUserId = null;
    const isSeller = listing.seller.toString() === userId.toString();

    if (isSeller) {
      const other = visibleMessages.find((m) => m.sender._id.toString() !== userId.toString());
      otherUserId = other ? other.sender._id : null;
    } else {
      otherUserId = listing.seller;
    }

    res.json({ messages: visibleMessages, otherUserId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/chat/:listingId
async function sendMessage(req, res) {
  try {
    const { listingId } = req.params;
    const { receiverId, content } = req.body;

    if (!receiverId || !content) {
      return res.status(400).json({ error: 'receiverId and content are required' });
    }

    const message = await Message.create({
      listing: listingId,
      sender: req.user._id,
      receiver: receiverId,
      content,
    });

    res.status(201).json(message);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// PATCH /api/chat/:messageId/read
async function markAsRead(req, res) {
  try {
    const message = await Message.findByIdAndUpdate(
      req.params.messageId,
      { read: true },
      { new: true }
    );
    if (!message) return res.status(404).json({ error: 'Message not found' });
    res.json(message);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/chat
async function getConversations(req, res) {
  try {
    const userId = req.user._id;

    const messages = await Message.find({
      $or: [{ sender: userId }, { receiver: userId }],
    })
      .sort({ createdAt: -1 })
      .populate('sender', 'fullName')
      .populate('receiver', 'fullName')
      .populate('listing', 'title photos');

    const seen = new Set();
    const conversations = [];

    for (const msg of messages) {
      if (!msg.listing) continue;
      const listingId = msg.listing._id.toString();
      if (seen.has(listingId)) continue;
      seen.add(listingId);

      const otherUser = msg.sender._id.toString() === userId.toString() ? msg.receiver : msg.sender;

      conversations.push({
        listingId,
        listingTitle: msg.listing.title,
        listingPhoto: msg.listing.photos?.[0],
        otherUser: { id: otherUser._id, fullName: otherUser.fullName },
        lastMessage: msg.content,
        lastMessageAt: msg.createdAt,
      });
    }

    res.json(conversations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// DELETE /api/chat/message/:messageId
async function deleteMessage(req, res) {
  try {
    const { messageId } = req.params;
    const { forEveryone } = req.body;
    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ error: 'Message not found' });

    if (forEveryone) {
      if (message.sender.toString() !== req.user._id.toString()) {
        return res.status(403).json({ error: 'Only the sender can delete for everyone' });
      }
      message.deletedForEveryone = true;
      message.content = 'This message was deleted';
      await message.save();
    } else {
      if (!message.deletedFor.some((id) => id.toString() === req.user._id.toString())) {
        message.deletedFor.push(req.user._id);
        await message.save();
      }
    }

    res.json(message);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getConversation, deleteMessage, sendMessage, markAsRead, getConversations };