const MONEY_FORMATTER = new Intl.NumberFormat("zh-TW", {
  style: "currency",
  currency: "TWD",
  maximumFractionDigits: 0,
});

const NUMBER_FORMATTER = new Intl.NumberFormat("zh-TW", {
  maximumFractionDigits: 0,
});

const form = document.querySelector("#tax-form");
const moneyInputs = document.querySelectorAll("[data-money]");
const acquiredDate = document.querySelector("#acquiredDate");
const soldDate = document.querySelector("#soldDate");
const salePrice = document.querySelector("#salePrice");
const cost = document.querySelector("#cost");
const expenses = document.querySelector("#expenses");
const landValueIncrement = document.querySelector("#landValueIncrement");
const selfUse = document.querySelector("#selfUse");
const involuntary = document.querySelector("#involuntary");
const rebuyEnabled = document.querySelector("#rebuyEnabled");
const newHomePrice = document.querySelector("#newHomePrice");
const paidTax = document.querySelector("#paidTax");
const expenseField = document.querySelector("#expense-field");

const output = {
  taxDue: document.querySelector("#taxDue"),
  taxableIncome: document.querySelector("#taxableIncome"),
  taxRate: document.querySelector("#taxRate"),
  holdingPeriod: document.querySelector("#holdingPeriod"),
  expenseUsed: document.querySelector("#expenseUsed"),
  formulaText: document.querySelector("#formulaText"),
  rebuyResult: document.querySelector("#rebuyResult"),
  refundAmount: document.querySelector("#refundAmount"),
  refundNote: document.querySelector("#refundNote"),
  alerts: document.querySelector("#alerts"),
};

function parseMoney(input) {
  return Number(String(input.value).replace(/[^\d.-]/g, "")) || 0;
}

function formatMoneyInput(input) {
  const value = parseMoney(input);
  input.value = value ? NUMBER_FORMATTER.format(value) : "";
}

function addYears(date, years) {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + years);
  return result;
}

function daysBetween(start, end) {
  const day = 24 * 60 * 60 * 1000;
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.max(0, Math.round((endUtc - startUtc) / day));
}

function getHoldingInfo(start, end) {
  if (!start || !end || end < start) {
    return {
      days: 0,
      label: "日期待確認",
      bracket: "invalid",
      rate: 0,
      rateLabel: "0%",
    };
  }

  const days = daysBetween(start, end);
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  const label = `${NUMBER_FORMATTER.format(days)} 天，約 ${years} 年 ${months} 個月`;

  if (end <= addYears(start, 2)) {
    return { days, label, bracket: "2 年以內", rate: 0.45, rateLabel: "45%" };
  }
  if (end <= addYears(start, 5)) {
    return { days, label, bracket: "超過 2 年，未逾 5 年", rate: 0.35, rateLabel: "35%" };
  }
  if (end <= addYears(start, 10)) {
    return { days, label, bracket: "超過 5 年，未逾 10 年", rate: 0.2, rateLabel: "20%" };
  }
  return { days, label, bracket: "超過 10 年", rate: 0.15, rateLabel: "15%" };
}

function getTaxRate(holdingInfo, taxableBeforeSelfUse) {
  if (selfUse.checked) {
    return {
      rate: 0.1,
      rateLabel: taxableBeforeSelfUse > 4_000_000 ? "10%" : "0%",
      note: "自住房地優惠：課稅所得 400 萬元以內免稅，超過部分按 10% 計算。",
    };
  }

  if (involuntary.checked) {
    return {
      rate: 0.2,
      rateLabel: "20%",
      note: "非自願因素：此處依使用者勾選套用 20% 稅率，實際資格仍須由國稅局認定。",
    };
  }

  return {
    rate: holdingInfo.rate,
    rateLabel: holdingInfo.rateLabel,
    note: `一般境內居住個人：持有期間為「${holdingInfo.bracket}」。`,
  };
}

function renderAlerts(alerts) {
  output.alerts.innerHTML = alerts
    .map(
      (alert) => `
        <div class="alert ${alert.type}">
          <strong>${alert.title}</strong>
          <p>${alert.text}</p>
        </div>
      `,
    )
    .join("");
}

function calculate() {
  const start = acquiredDate.value ? new Date(`${acquiredDate.value}T00:00:00`) : null;
  const end = soldDate.value ? new Date(`${soldDate.value}T00:00:00`) : null;
  const sale = parseMoney(salePrice);
  const acquisitionCost = parseMoney(cost);
  const landIncrement = parseMoney(landValueIncrement);
  const expenseMode = new FormData(form).get("expenseMode");
  const estimatedExpense = Math.min(sale * 0.03, 300_000);
  const expenseValue = expenseMode === "estimate" ? estimatedExpense : parseMoney(expenses);
  const rawIncome = sale - acquisitionCost - expenseValue - landIncrement;
  const taxableBeforeSelfUse = Math.max(0, rawIncome);
  const selfUseDeduction = selfUse.checked ? Math.min(taxableBeforeSelfUse, 4_000_000) : 0;
  const taxable = Math.max(0, taxableBeforeSelfUse - selfUseDeduction);
  const holdingInfo = getHoldingInfo(start, end);
  const rateInfo = getTaxRate(holdingInfo, taxableBeforeSelfUse);
  const taxDue = Math.round(taxable * rateInfo.rate);

  expenseField.hidden = expenseMode === "estimate";
  output.taxDue.textContent = MONEY_FORMATTER.format(taxDue);
  output.taxableIncome.textContent = MONEY_FORMATTER.format(taxable);
  output.taxRate.textContent = rateInfo.rateLabel;
  output.holdingPeriod.textContent = holdingInfo.label;
  output.expenseUsed.textContent = MONEY_FORMATTER.format(expenseValue);

  const selfUseText = selfUse.checked ? ` - 自住免稅額 ${MONEY_FORMATTER.format(selfUseDeduction)}` : "";
  output.formulaText.textContent =
    `${MONEY_FORMATTER.format(sale)} - ${MONEY_FORMATTER.format(acquisitionCost)} - ` +
    `${MONEY_FORMATTER.format(expenseValue)} - ${MONEY_FORMATTER.format(landIncrement)}` +
    `${selfUseText} = ${MONEY_FORMATTER.format(taxable)}；${rateInfo.note}`;

  const alerts = [];
  if (start && start <= new Date("2015-12-31T00:00:00")) {
    alerts.push({
      type: "warning",
      title: "新制適用提醒",
      text: "104 年 12 月 31 日以前取得之房地通常不適用房地合一新制；若跨新舊制或特殊標的，請另行確認。",
    });
  }
  if (end && end < start) {
    alerts.push({
      type: "danger",
      title: "日期需要確認",
      text: "交易日期早於取得日期，持有期間與稅率無法正確判斷。",
    });
  }
  if (expenseMode === "estimate") {
    alerts.push({
      type: "warning",
      title: "必要費用估算",
      text: "未提供費用證明時，以成交總價 3% 估算，最高 30 萬元。本次採用 " + MONEY_FORMATTER.format(expenseValue) + "。",
    });
  }
  alerts.push({
    type: "warning",
    title: "申報期限",
    text: "完成所有權移轉登記日之次日起 30 日內應辦理申報；重購退稅後 5 年內不得改作他用或移轉。",
  });
  renderAlerts(alerts);

  renderRebuy(sale, taxDue);
}

function renderRebuy(sale, calculatedTaxDue) {
  if (!rebuyEnabled.checked) {
    output.rebuyResult.hidden = true;
    return;
  }

  const newPrice = parseMoney(newHomePrice);
  const taxPaid = parseMoney(paidTax) || calculatedTaxDue;
  const refund =
    newPrice >= sale || sale === 0 ? taxPaid : Math.round(taxPaid * Math.max(0, newPrice / sale));

  output.rebuyResult.hidden = false;
  output.refundAmount.textContent = MONEY_FORMATTER.format(refund);
  output.refundNote.textContent =
    newPrice >= sale
      ? "小換大或等價換屋：符合條件時可全額退還已繳納之房地合一稅。"
      : "大換小：依新購買入價除以舊屋賣出價的比例退還。";
}

moneyInputs.forEach((input) => {
  input.addEventListener("blur", () => {
    formatMoneyInput(input);
    calculate();
  });
});

form.addEventListener("input", calculate);
form.addEventListener("reset", () => {
  setTimeout(calculate, 0);
});

calculate();
