const Message = require('../models/Message');
const Listing = require('../models/Listing');
const { notifyNewMessage } = require('../utils/notify');
const { isUserActiveInRoom } = require('../socket');

// GET /api/chat/:listingId/:otherUserId
async function getConversation(req, res) {
  try {
    const { listingId, otherUserId } = req.params;
    const userId = req.user._id;

    const listing = await Listing.findById(listingId).select('seller');
    if (!listing) return res.status(404).json({ error: 'Listing not found' });

    const messages = await Message.find({
      listing: listingId,
      $or: [
        { sender: userId, receiver: otherUserId },
        { sender: otherUserId, receiver: userId },
      ],
    })
      .sort({ createdAt: 1 })
      .populate('sender', 'fullName')
      .populate('receiver', 'fullName');

    const visibleMessages = messages.filter(
      (m) => !m.deletedFor.some((id) => id.toString() === userId.toString())
    );

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

    // Fire-and-forget: a notification failure must never affect the response above
    (async () => {
      try {
        const listing = await Listing.findById(listingId).select('title');
        const room = [listingId, [req.user._id.toString(), String(receiverId)].sort().join('-')].join(':');
        await notifyNewMessage({
          recipientId: receiverId,
          senderId: req.user._id,
          senderName: req.user.fullName,
          listingId,
          listingTitle: listing?.title || 'an item',
          room,
          isUserActiveInRoom,
        });
      } catch (err) {
        console.error('sendMessage notify failed:', err.message);
      }
    })();
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
      const otherUser = msg.sender._id.toString() === userId.toString() ? msg.receiver : msg.sender;
      if (!otherUser) continue;

      const key = `${msg.listing._id}:${otherUser._id}`;
      if (seen.has(key)) continue;
      seen.add(key);

      conversations.push({
        listingId: msg.listing._id.toString(),
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