import React, { useMemo } from "react";
import { View, StyleSheet, Text } from "react-native";
import LottieView from "lottie-react-native";

const EMOJI_ANIMATIONS: Record<string, any> = {
  "❤️": require("@/assets/animations/emojis/heart.json"),
  "❤": require("@/assets/animations/emojis/heart.json"),
  "🧡": require("@/assets/animations/emojis/orange-heart.json"),
  "💛": require("@/assets/animations/emojis/yellow-heart.json"),
  "💚": require("@/assets/animations/emojis/green-heart.json"),
  "💙": require("@/assets/animations/emojis/blue-heart.json"),
  "💜": require("@/assets/animations/emojis/purple-heart.json"),
  "🖤": require("@/assets/animations/emojis/black-heart.json"),
  "🤍": require("@/assets/animations/emojis/white-heart.json"),
  "🤎": require("@/assets/animations/emojis/brown-heart.json"),
  "🩷": require("@/assets/animations/emojis/pink-heart.json"),
  "💔": require("@/assets/animations/emojis/broken-heart.json"),
  "❤️‍🔥": require("@/assets/animations/emojis/heart-on-fire.json"),
  "❤️‍🩹": require("@/assets/animations/emojis/mending-heart.json"),
  "💕": require("@/assets/animations/emojis/two-hearts.json"),
  "💞": require("@/assets/animations/emojis/revolving-hearts.json"),
  "💓": require("@/assets/animations/emojis/beating-heart.json"),
  "💗": require("@/assets/animations/emojis/growing-heart.json"),
  "💖": require("@/assets/animations/emojis/sparkling-heart.json"),
  "💝": require("@/assets/animations/emojis/gift-heart.json"),
  "💘": require("@/assets/animations/emojis/cupid.json"),
  "💟": require("@/assets/animations/emojis/heart-decoration.json"),
  "❣️": require("@/assets/animations/emojis/heart-exclamation.json"),
  "💌": require("@/assets/animations/emojis/love-letter.json"),
  "💋": require("@/assets/animations/emojis/kiss-mark.json"),
  "👍": require("@/assets/animations/emojis/thumbs-up.json"),
  "👍🏻": require("@/assets/animations/emojis/thumbs-up.json"),
  "👍🏼": require("@/assets/animations/emojis/thumbs-up.json"),
  "👍🏽": require("@/assets/animations/emojis/thumbs-up.json"),
  "👍🏾": require("@/assets/animations/emojis/thumbs-up.json"),
  "👍🏿": require("@/assets/animations/emojis/thumbs-up.json"),
  "👎": require("@/assets/animations/emojis/thumbs-down.json"),
  "👎🏻": require("@/assets/animations/emojis/thumbs-down.json"),
  "👎🏼": require("@/assets/animations/emojis/thumbs-down.json"),
  "👎🏽": require("@/assets/animations/emojis/thumbs-down.json"),
  "👎🏾": require("@/assets/animations/emojis/thumbs-down.json"),
  "👎🏿": require("@/assets/animations/emojis/thumbs-down.json"),
  "😂": require("@/assets/animations/emojis/laugh-cry.json"),
  "🤣": require("@/assets/animations/emojis/rolling-laughing.json"),
  "😍": require("@/assets/animations/emojis/heart-eyes.json"),
  "🥰": require("@/assets/animations/emojis/smiling-hearts.json"),
  "😘": require("@/assets/animations/emojis/face-blowing-kiss.json"),
  "😗": require("@/assets/animations/emojis/kissing.json"),
  "😚": require("@/assets/animations/emojis/kissing-closed-eyes.json"),
  "😙": require("@/assets/animations/emojis/kissing-smiling-eyes.json"),
  "🥲": require("@/assets/animations/emojis/smiling-tear.json"),
  "😊": require("@/assets/animations/emojis/smiling.json"),
  "🙂": require("@/assets/animations/emojis/smiling.json"),
  "😇": require("@/assets/animations/emojis/smiling-halo.json"),
  "😀": require("@/assets/animations/emojis/grinning-face.json"),
  "😁": require("@/assets/animations/emojis/beaming-face.json"),
  "😆": require("@/assets/animations/emojis/grinning-squinting.json"),
  "😅": require("@/assets/animations/emojis/grinning-squinting.json"),
  "🤗": require("@/assets/animations/emojis/hugging-face.json"),
  "😉": require("@/assets/animations/emojis/winking-face.json"),
  "🤩": require("@/assets/animations/emojis/star-struck.json"),
  "🤪": require("@/assets/animations/emojis/zany-face.json"),
  "😎": require("@/assets/animations/emojis/sunglasses.json"),
  "🤑": require("@/assets/animations/emojis/money-mouth.json"),
  "🤓": require("@/assets/animations/emojis/nerd.json"),
  "🧐": require("@/assets/animations/emojis/monocle.json"),
  "🤔": require("@/assets/animations/emojis/thinking.json"),
  "🙃": require("@/assets/animations/emojis/upside-down.json"),
  "🫠": require("@/assets/animations/emojis/melting.json"),
  "😌": require("@/assets/animations/emojis/relieved.json"),
  "😋": require("@/assets/animations/emojis/savoring.json"),
  "😛": require("@/assets/animations/emojis/tongue-out.json"),
  "😜": require("@/assets/animations/emojis/tongue-wink.json"),
  "😝": require("@/assets/animations/emojis/tongue-squint.json"),
  "🤡": require("@/assets/animations/emojis/clown.json"),
  "🤠": require("@/assets/animations/emojis/cowboy.json"),
  "🥳": require("@/assets/animations/emojis/partying.json"),
  "🥸": require("@/assets/animations/emojis/disguised.json"),
  "😏": require("@/assets/animations/emojis/smirking.json"),
  "😒": require("@/assets/animations/emojis/unamused.json"),
  "🙄": require("@/assets/animations/emojis/rolling-eyes.json"),
  "😬": require("@/assets/animations/emojis/grimacing.json"),
  "😮‍💨": require("@/assets/animations/emojis/exhaling.json"),
  "🤥": require("@/assets/animations/emojis/lying.json"),
  "😔": require("@/assets/animations/emojis/disappointed.json"),
  "😕": require("@/assets/animations/emojis/confused.json"),
  "😟": require("@/assets/animations/emojis/worried.json"),
  "🙁": require("@/assets/animations/emojis/frowning.json"),
  "😮": require("@/assets/animations/emojis/surprised.json"),
  "😯": require("@/assets/animations/emojis/hushed.json"),
  "😲": require("@/assets/animations/emojis/astonished.json"),
  "😳": require("@/assets/animations/emojis/flushed.json"),
  "🥺": require("@/assets/animations/emojis/pleading.json"),
  "😦": require("@/assets/animations/emojis/frowning.json"),
  "😧": require("@/assets/animations/emojis/open-mouth.json"),
  "😨": require("@/assets/animations/emojis/fearful.json"),
  "😰": require("@/assets/animations/emojis/anxious-sweat.json"),
  "😥": require("@/assets/animations/emojis/sad-relieved.json"),
  "😢": require("@/assets/animations/emojis/crying-face.json"),
  "😭": require("@/assets/animations/emojis/crying.json"),
  "😱": require("@/assets/animations/emojis/screaming.json"),
  "😖": require("@/assets/animations/emojis/confounded.json"),
  "😣": require("@/assets/animations/emojis/persevering.json"),
  "😞": require("@/assets/animations/emojis/disappointed.json"),
  "😓": require("@/assets/animations/emojis/downcast-sweat.json"),
  "😩": require("@/assets/animations/emojis/weary.json"),
  "😫": require("@/assets/animations/emojis/tired.json"),
  "🥱": require("@/assets/animations/emojis/yawning.json"),
  "😤": require("@/assets/animations/emojis/steam-nose.json"),
  "😡": require("@/assets/animations/emojis/angry.json"),
  "😠": require("@/assets/animations/emojis/angry.json"),
  "🤬": require("@/assets/animations/emojis/angry.json"),
  "😈": require("@/assets/animations/emojis/smiling-horns.json"),
  "👿": require("@/assets/animations/emojis/angry-horns.json"),
  "💀": require("@/assets/animations/emojis/skull.json"),
  "☠️": require("@/assets/animations/emojis/skull.json"),
  "👻": require("@/assets/animations/emojis/ghost.json"),
  "👽": require("@/assets/animations/emojis/alien.json"),
  "👾": require("@/assets/animations/emojis/alien-monster.json"),
  "🤖": require("@/assets/animations/emojis/robot.json"),
  "💩": require("@/assets/animations/emojis/poop.json"),
  "🤯": require("@/assets/animations/emojis/exploding-head.json"),
  "🥶": require("@/assets/animations/emojis/cold-face.json"),
  "🥵": require("@/assets/animations/emojis/hot-face.json"),
  "🥴": require("@/assets/animations/emojis/woozy.json"),
  "😵": require("@/assets/animations/emojis/dizzy-face.json"),
  "🤫": require("@/assets/animations/emojis/shushing.json"),
  "🤭": require("@/assets/animations/emojis/hand-mouth.json"),
  "🫣": require("@/assets/animations/emojis/peeking.json"),
  "🤐": require("@/assets/animations/emojis/zipper-mouth.json"),
  "🤨": require("@/assets/animations/emojis/raised-eyebrow.json"),
  "😐": require("@/assets/animations/emojis/neutral.json"),
  "😑": require("@/assets/animations/emojis/expressionless.json"),
  "😶": require("@/assets/animations/emojis/no-mouth.json"),
  "🫥": require("@/assets/animations/emojis/dotted-line.json"),
  "😴": require("@/assets/animations/emojis/sleeping.json"),
  "😪": require("@/assets/animations/emojis/sleepy.json"),
  "🤤": require("@/assets/animations/emojis/drooling.json"),
  "😷": require("@/assets/animations/emojis/mask.json"),
  "🤒": require("@/assets/animations/emojis/thermometer.json"),
  "🤕": require("@/assets/animations/emojis/bandage.json"),
  "🤢": require("@/assets/animations/emojis/nauseated.json"),
  "🤮": require("@/assets/animations/emojis/vomiting.json"),
  "🤧": require("@/assets/animations/emojis/sneezing.json"),
  "😺": require("@/assets/animations/emojis/smiling-cat.json"),
  "😸": require("@/assets/animations/emojis/smiling-cat.json"),
  "😹": require("@/assets/animations/emojis/joy-cat.json"),
  "😻": require("@/assets/animations/emojis/heart-cat.json"),
  "😼": require("@/assets/animations/emojis/smirk-cat.json"),
  "😽": require("@/assets/animations/emojis/kissing-cat.json"),
  "🙀": require("@/assets/animations/emojis/weary-cat.json"),
  "😿": require("@/assets/animations/emojis/cry-cat.json"),
  "😾": require("@/assets/animations/emojis/pouting-cat.json"),
  "🙈": require("@/assets/animations/emojis/see-no-evil.json"),
  "🙉": require("@/assets/animations/emojis/hear-no-evil.json"),
  "🙊": require("@/assets/animations/emojis/speak-no-evil.json"),
  "🔥": require("@/assets/animations/emojis/fire.json"),
  "🎉": require("@/assets/animations/emojis/party.json"),
  "💯": require("@/assets/animations/emojis/hundred.json"),
  "✅": require("@/assets/animations/emojis/check.json"),
  "❌": require("@/assets/animations/emojis/cross.json"),
  "👏": require("@/assets/animations/emojis/clapping.json"),
  "👏🏻": require("@/assets/animations/emojis/clapping.json"),
  "👏🏼": require("@/assets/animations/emojis/clapping.json"),
  "👏🏽": require("@/assets/animations/emojis/clapping.json"),
  "👏🏾": require("@/assets/animations/emojis/clapping.json"),
  "👏🏿": require("@/assets/animations/emojis/clapping.json"),
  "🙏": require("@/assets/animations/emojis/pray.json"),
  "🙏🏻": require("@/assets/animations/emojis/pray.json"),
  "🙏🏼": require("@/assets/animations/emojis/pray.json"),
  "🙏🏽": require("@/assets/animations/emojis/pray.json"),
  "🙏🏾": require("@/assets/animations/emojis/pray.json"),
  "🙏🏿": require("@/assets/animations/emojis/pray.json"),
  "👋": require("@/assets/animations/emojis/wave.json"),
  "👋🏻": require("@/assets/animations/emojis/wave.json"),
  "👋🏼": require("@/assets/animations/emojis/wave.json"),
  "👋🏽": require("@/assets/animations/emojis/wave.json"),
  "👋🏾": require("@/assets/animations/emojis/wave.json"),
  "👋🏿": require("@/assets/animations/emojis/wave.json"),
  "✌️": require("@/assets/animations/emojis/victory.json"),
  "🤞": require("@/assets/animations/emojis/crossed-fingers.json"),
  "🤟": require("@/assets/animations/emojis/love-you.json"),
  "🤘": require("@/assets/animations/emojis/rock-on.json"),
  "🤙": require("@/assets/animations/emojis/call-me.json"),
  "👌": require("@/assets/animations/emojis/ok-hand.json"),
  "🤌": require("@/assets/animations/emojis/pinched.json"),
  "🤏": require("@/assets/animations/emojis/pinching.json"),
  "👈": require("@/assets/animations/emojis/backhand-left.json"),
  "👉": require("@/assets/animations/emojis/backhand-right.json"),
  "👆": require("@/assets/animations/emojis/backhand-up.json"),
  "👇": require("@/assets/animations/emojis/backhand-down.json"),
  "☝️": require("@/assets/animations/emojis/index-up.json"),
  "🖕": require("@/assets/animations/emojis/middle-finger.json"),
  "✊": require("@/assets/animations/emojis/fist.json"),
  "🤛": require("@/assets/animations/emojis/fist-left.json"),
  "🤜": require("@/assets/animations/emojis/fist-right.json"),
  "🤚": require("@/assets/animations/emojis/fist-bump.json"),
  "🖐️": require("@/assets/animations/emojis/palm.json"),
  "🖖": require("@/assets/animations/emojis/vulcan.json"),
  "👐": require("@/assets/animations/emojis/open-hands.json"),
  "🤲": require("@/assets/animations/emojis/palms-up.json"),
  "🤝": require("@/assets/animations/emojis/handshake.json"),
  "✍️": require("@/assets/animations/emojis/writing.json"),
  "💅": require("@/assets/animations/emojis/nail-polish.json"),
  "🤳": require("@/assets/animations/emojis/selfie.json"),
  "💪": require("@/assets/animations/emojis/muscle.json"),
  "🦵": require("@/assets/animations/emojis/leg.json"),
  "🦶": require("@/assets/animations/emojis/foot.json"),
  "👂": require("@/assets/animations/emojis/ear.json"),
  "👃": require("@/assets/animations/emojis/nose.json"),
  "👀": require("@/assets/animations/emojis/eyes.json"),
  "🙌": require("@/assets/animations/emojis/raising-hands.json"),
  "🫶": require("@/assets/animations/emojis/heart-hands.json"),
  "🚀": require("@/assets/animations/emojis/rocket.json"),
  "🌈": require("@/assets/animations/emojis/rainbow.json"),
  "✨": require("@/assets/animations/emojis/sparkles.json"),
  "⚡": require("@/assets/animations/emojis/lightning.json"),
  "💫": require("@/assets/animations/emojis/dizzy.json"),
  "💥": require("@/assets/animations/emojis/collision.json"),
  "💧": require("@/assets/animations/emojis/droplet.json"),
  "💣": require("@/assets/animations/emojis/bomb.json"),
  "🎁": require("@/assets/animations/emojis/gift.json"),
  "🎂": require("@/assets/animations/emojis/birthday-cake.json"),
  "🎈": require("@/assets/animations/emojis/balloon.json"),
  "🎊": require("@/assets/animations/emojis/confetti-ball.json"),
  "🎃": require("@/assets/animations/emojis/jack-lantern.json"),
  "🎆": require("@/assets/animations/emojis/fireworks.json"),
  "🪩": require("@/assets/animations/emojis/mirror-ball.json"),
  "🪄": require("@/assets/animations/emojis/magic-wand.json"),
  "🔮": require("@/assets/animations/emojis/crystal-ball.json"),
  "🦋": require("@/assets/animations/emojis/butterfly.json"),
  "🐝": require("@/assets/animations/emojis/bee.json"),
  "🐞": require("@/assets/animations/emojis/ladybug.json"),
  "🐌": require("@/assets/animations/emojis/snail.json"),
  "🐙": require("@/assets/animations/emojis/octopus.json"),
  "🐟": require("@/assets/animations/emojis/fish.json"),
  "🐡": require("@/assets/animations/emojis/blowfish.json"),
  "🐬": require("@/assets/animations/emojis/dolphin.json"),
  "🐳": require("@/assets/animations/emojis/whale.json"),
  "🦈": require("@/assets/animations/emojis/shark.json"),
  "🦀": require("@/assets/animations/emojis/crab.json"),
  "🦄": require("@/assets/animations/emojis/unicorn.json"),
  "🐣": require("@/assets/animations/emojis/hatching.json"),
  "🐦": require("@/assets/animations/emojis/bird.json"),
  "🐸": require("@/assets/animations/emojis/frog.json"),
  "🐱": require("@/assets/animations/emojis/cat.json"),
  "🐮": require("@/assets/animations/emojis/cow.json"),
  "🐰": require("@/assets/animations/emojis/bouquet.json"),
  "🌹": require("@/assets/animations/emojis/rose.json"),
  "🌸": require("@/assets/animations/emojis/bouquet.json"),
  "💐": require("@/assets/animations/emojis/bouquet.json"),
  "☕": require("@/assets/animations/emojis/coffee.json"),
  "🍿": require("@/assets/animations/emojis/popcorn.json"),
  "🍜": require("@/assets/animations/emojis/ramen.json"),
  "🍕": require("@/assets/animations/emojis/ramen.json"),
  "🍻": require("@/assets/animations/emojis/clinking-beers.json"),
  "🍾": require("@/assets/animations/emojis/champagne.json"),
  "🍷": require("@/assets/animations/emojis/wine.json"),
  "🍹": require("@/assets/animations/emojis/tropical-drink.json"),
  "🌪️": require("@/assets/animations/emojis/tornado.json"),
  "🌧️": require("@/assets/animations/emojis/rain.json"),
  "❄️": require("@/assets/animations/emojis/snow.json"),
  "⛄": require("@/assets/animations/emojis/snowman.json"),
  "☄️": require("@/assets/animations/emojis/comet.json"),
  "🌞": require("@/assets/animations/emojis/sun-face.json"),
  "🏆": require("@/assets/animations/emojis/trophy.json"),
  "🥇": require("@/assets/animations/emojis/first-place.json"),
  "🥈": require("@/assets/animations/emojis/second-place.json"),
  "🥉": require("@/assets/animations/emojis/third-place.json"),
  "⚽": require("@/assets/animations/emojis/soccer.json"),
  "🎾": require("@/assets/animations/emojis/tennis.json"),
  "🎳": require("@/assets/animations/emojis/bowling.json"),
  "⛳": require("@/assets/animations/emojis/golf.json"),
  "🎯": require("@/assets/animations/emojis/target.json"),
  "🎲": require("@/assets/animations/emojis/dice.json"),
  "🎰": require("@/assets/animations/emojis/slot-machine.json"),
  "🎬": require("@/assets/animations/emojis/movie.json"),
  "🎵": require("@/assets/animations/emojis/musical-notes.json"),
  "🎶": require("@/assets/animations/emojis/musical-notes.json"),
  "🎺": require("@/assets/animations/emojis/trumpet.json"),
  "🥁": require("@/assets/animations/emojis/drum.json"),
  "🔔": require("@/assets/animations/emojis/bell.json"),
  "💡": require("@/assets/animations/emojis/lightbulb.json"),
  "💎": require("@/assets/animations/emojis/gem.json"),
  "💸": require("@/assets/animations/emojis/money-wings.json"),
  "⏰": require("@/assets/animations/emojis/alarm.json"),
  "🔒": require("@/assets/animations/emojis/lock.json"),
  "⚙️": require("@/assets/animations/emojis/gear.json"),
  "🦠": require("@/assets/animations/emojis/microbe.json"),
  "💍": require("@/assets/animations/emojis/ring.json"),
  "🎓": require("@/assets/animations/emojis/graduation.json"),
  "🏎️": require("@/assets/animations/emojis/racing-car.json"),
  "🚌": require("@/assets/animations/emojis/bus.json"),
  "🚗": require("@/assets/animations/emojis/car.json"),
  "🚕": require("@/assets/animations/emojis/taxi.json"),
  "🚲": require("@/assets/animations/emojis/bicycle.json"),
  "⛵": require("@/assets/animations/emojis/sailboat.json"),
  "🚧": require("@/assets/animations/emojis/construction.json"),
  "⚠️": require("@/assets/animations/emojis/warning.json"),
  "♾️": require("@/assets/animations/emojis/infinity.json"),
  "❓": require("@/assets/animations/emojis/question.json"),
  "❗": require("@/assets/animations/emojis/exclamation.json"),
  "🆕": require("@/assets/animations/emojis/new.json"),
  "🆓": require("@/assets/animations/emojis/free.json"),
  "🆘": require("@/assets/animations/emojis/sos.json"),
  "🆙": require("@/assets/animations/emojis/up.json"),
  "🆒": require("@/assets/animations/emojis/cool.json"),
};

const EMOJI_REGEX = /(\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\p{Regional_Indicator}{2})(\p{Emoji_Modifier})?/gu;

interface AnimatedEmojiProps {
  emoji: string;
  size: number;
}

export function AnimatedEmoji({ emoji, size }: AnimatedEmojiProps) {
  const normalizedEmoji = emoji.replace(/\uFE0F/g, "");
  const animation = EMOJI_ANIMATIONS[emoji] || EMOJI_ANIMATIONS[normalizedEmoji];
  
  if (!animation) {
    return (
      <Text style={[styles.fallbackEmoji, { fontSize: size * 0.85 }]}>
        {emoji}
      </Text>
    );
  }

  return (
    <LottieView
      source={animation}
      autoPlay
      loop
      style={{ width: size, height: size }}
    />
  );
}

interface AnimatedEmojiTextProps {
  text: string;
  emojiSize: number;
}

export function AnimatedEmojiText({ text, emojiSize }: AnimatedEmojiTextProps) {
  const parts = useMemo(() => {
    const result: Array<{ type: "emoji" | "text"; content: string }> = [];
    let lastIndex = 0;
    
    const matches = text.matchAll(EMOJI_REGEX);
    
    for (const match of matches) {
      if (match.index !== undefined && match.index > lastIndex) {
        result.push({ type: "text", content: text.slice(lastIndex, match.index) });
      }
      result.push({ type: "emoji", content: match[0] });
      lastIndex = (match.index || 0) + match[0].length;
    }
    
    if (lastIndex < text.length) {
      result.push({ type: "text", content: text.slice(lastIndex) });
    }
    
    return result;
  }, [text]);

  return (
    <View style={styles.container}>
      {parts.map((part, index) => {
        if (part.type === "emoji") {
          return (
            <View key={index} style={styles.emojiWrapper}>
              <AnimatedEmoji emoji={part.content} size={emojiSize} />
            </View>
          );
        }
        if (part.content.trim() === "") {
          return <View key={index} style={{ width: emojiSize * 0.15 }} />;
        }
        return null;
      })}
    </View>
  );
}

export function hasAnimatedEmoji(text: string): boolean {
  const matches = text.match(EMOJI_REGEX);
  if (!matches) return false;
  
  return matches.some(emoji => {
    const normalizedEmoji = emoji.replace(/\uFE0F/g, "");
    return EMOJI_ANIMATIONS[emoji] || EMOJI_ANIMATIONS[normalizedEmoji];
  });
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
  },
  emojiWrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackEmoji: {
    textAlign: "center",
  },
});
