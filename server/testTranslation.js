const {
  translateText
} = require("./services/translationService");


async function test() {

  try {

    console.log("\nHausa -> English");

    const hausa =
      await translateText(
        "Ya ya kake?",
        "Hausa",
        "English"
      );

    console.log(hausa);


    console.log("\nEnglish -> French");

    const french =
      await translateText(
        "How are you?",
        "English",
        "French"
      );

    console.log(french);


    console.log("\nEnglish -> Arabic");

    const arabic =
      await translateText(
        "How are you?",
        "English",
        "Arabic"
      );

    console.log(arabic);


    console.log("\nFrench -> English");

    const english =
      await translateText(
        "Comment allez-vous ?",
        "French",
        "English"
      );

    console.log(english);


  } catch (error) {

    console.error(
      "\nTranslation test failed:",
      error.message
    );

  }

}


test();