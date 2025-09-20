function getCurrentYearShort() {
    return new Date().getFullYear().toString().slice(-2);
}

document.getElementById("generate").addEventListener("click", () => {
    const year = getCurrentYearShort();
    const storageKey = "saksnummer_" + year;

    let lastNumber = localStorage.getItem(storageKey);

    if (!lastNumber) {
        // Start from 200 if 2025, otherwise reset to 1
        lastNumber = (year === "25") ? 200 : 1;
    } else {
        lastNumber = parseInt(lastNumber) + 1;
    }

    localStorage.setItem(storageKey, lastNumber);

    const caseNumber = year + "/" + String(lastNumber).padStart(6, "0");
    document.getElementById("output").textContent = caseNumber;
});
