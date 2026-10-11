const Message = require('../models/Message');
const Listing = require('../models/Listing');
const { notifyNewMessage } = require('../utils/notify');
const { isUserActiveInRoom } = require('../socket');

const MAX_MESSAGE_LENGTH = 2000;

const isId = (v) => typeof v === 'string' && /^[a-f\d]{24}$/i.test(v);

// True when the user is the sender or the receiver of this message
function isParticipant(message, userId) {
  const me = String(userId);
  return String(message.sender) === me || String(message.receiver) === me;
}

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
    const { receiverId } = req.body;
    const content = typeof req.body.content === 'string' ? req.body.content.trim() : '';

    if (!receiverId || !content) {
      return res.status(400).json({ error: 'receiverId and content are required' });
    }
    if (content.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ error: `Messages can be up to ${MAX_MESSAGE_LENGTH} characters` });
    }
    if (!isId(listingId) || !isId(String(receiverId))) {
      return res.status(400).json({ error: 'Invalid listing or user' });
    }

    const senderId = String(req.user._id);
    if (String(receiverId) === senderId) {
      return res.status(400).json({ error: "You can't message yourself" });
    }

    const listing = await Listing.findById(listingId).select('title seller');
    if (!listing) return res.status(404).json({ error: 'Listing not found' });

    // Messages about a listing go between its seller and one other person
    const sellerId = String(listing.seller);
    const senderIsSeller = senderId === sellerId;
    const receiverIsSeller = String(receiverId) === sellerId;
    if (!senderIsSeller && !receiverIsSeller) {
      return res.status(403).json({ error: 'Messages about a listing go between the buyer and the seller' });
    }

    // A seller can only reply to someone who has already messaged them about this listing
    if (senderIsSeller) {
      const hasWrittenFirst = await Message.exists({
        listing: listingId,
        sender: receiverId,
        receiver: req.user._id,
      });
      if (!hasWrittenFirst) {
        return res
          .status(403)
          .json({ error: 'You can only reply to buyers who have messaged you about this listing' });
      }
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
        const room = [listingId, [senderId, String(receiverId)].sort().join('-')].join(':');
        await notifyNewMessage({
          recipientId: receiverId,
          senderId: req.user._id,
          senderName: req.user.fullName,
          listingId,
          listingTitle: listing.title || 'an item',
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
// Only the two people in the conversation can use this; everyone else gets "not found"
async function markAsRead(req, res) {
  try {
    const { messageId } = req.params;
    if (!isId(messageId)) return res.status(404).json({ error: 'Message not found' });

    const message = await Message.findOneAndUpdate(
      {
        _id: messageId,
        $or: [{ sender: req.user._id }, { receiver: req.user._id }],
      },
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
// Only the two people in the conversation can delete; "for everyone" is sender-only
async function deleteMessage(req, res) {
  try {
    const { messageId } = req.params;
    const { forEveryone } = req.body;
    if (!isId(messageId)) return res.status(404).json({ error: 'Message not found' });

    const message = await Message.findById(messageId);
    if (!message || !isParticipant(message, req.user._id)) {
      return res.status(404).json({ error: 'Message not found' });
    }

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